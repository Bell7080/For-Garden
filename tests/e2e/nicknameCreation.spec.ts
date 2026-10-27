import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap } from "./canvasInput";

// 소스 서버에서 실제 RemoteGameApi → 서버 처리기 → 저장 → 응답을 검증한다.
test("1-1 뒤 닉네임 생성 · SD 안내 · 정책 도움말 · 저장 실패 복구 · 재접속", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  const dir = await mkdtemp(join(tmpdir(), "fg-nickname-"));
  try {
    const file = join(dir, "fixture.mjs");
    await build({ entryPoints: ["tests/helpers/remoteBattleFixture.ts"], outfile: file, bundle: true, platform: "node", format: "esm",
      define: { "import.meta.env": "{}", "import.meta.env.MODE": '"production"', "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" } });
    const { createFixture } = await import(pathToFileURL(file).href);
    const server = createFixture("stage", (s: any) => {
      s.playerCard.nickname = ""; s.cleared = new Set(["1-1"]);
      s.tutorial = { completedStepIds: ["ultimate"] }; s.selectedStageId = "1-2";
      s.settings.game.language = "ko";
    });
    await page.exposeFunction("__NICK_CALL", server.call);
    await installGameHandleProbe(page);
    await startAfterOpening(page, s => { s.playerCard.nickname = ""; s.settings.game.language = "ko"; });
    await page.evaluate(async () => {
      const root = "/src/";
      const [fake, remote, state, saves, progress, profile] = await Promise.all([
        import(/* @vite-ignore */root+"api/FakeServer.ts"), import(/* @vite-ignore */root+"api/RemoteGameApi.ts"),
        import(/* @vite-ignore */root+"state/session.ts"), import(/* @vite-ignore */root+"state/SaveManager.ts"),
        import(/* @vite-ignore */root+"api/serverProgress.ts"), import(/* @vite-ignore */root+"managers/PlayerCardManager.ts"),
      ]);
      const api = remote.createRemoteGameApi({ getAccessToken: async () => "isolated-nickname",
        applyState: (next: unknown) => progress.applyServerState(state.session, next, saves.saveManager),
        fetchImpl: async (_url: unknown, init: RequestInit) => {
          const r = await (window as any).__NICK_CALL(JSON.parse(String(init.body)));
          return new Response(JSON.stringify(r.body), { status: r.status });
        },
      });
      fake.installGameApi(api); await api.getPlayerState();
      (window as any).__NICK_RESTORE = profile.playerCardManager.setNickname.bind(profile.playerCardManager);
      profile.playerCardManager.setNickname = async () => ({ ok: false, reason: "tooShort" });
    });
    await sourceScene(page, "window.__NICK_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("반가워요, 연구원 님!");
    await expect.poll(() => page.evaluate(() => ["dodo", "parua"].every(id =>
      (window as any).__NICK_GAME.scene.getScene("lobby").children.getByName(`nickname-guide-${id}`)?.visible)), { timeout: 60000 }).toBe(true);
    await captureGame(page, info.outputPath("nickname-create.png"));
    // 생성창은 배경을 눌러도 닫히지 않는다.
    await tap(page, 30, 500);
    await expect(page.getByLabel("닉네임", { exact: true })).toHaveCount(1);
    await tap(page, 870, 982);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("이름 사용 안내");
    await captureGame(page, info.outputPath("nickname-help.png"));
    await tap(page, 30, 500);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).not.toContain("이름 사용 안내");
    await page.getByLabel("닉네임", { exact: true }).fill("도디의연구원");
    await tap(page, 540, 1370);
    await expect(page.getByLabel("닉네임", { exact: true })).toHaveCount(1);
    expect(server.state().playerCard.nickname).toBe("");
    await page.evaluate(async () => {
      const root = "/src/"; const profile = await import(/* @vite-ignore */root+"managers/PlayerCardManager.ts");
      profile.playerCardManager.setNickname = (window as any).__NICK_RESTORE;
    });
    await tap(page, 540, 1370);
    await expect.poll(() => server.state().playerCard.nickname).toBe("도디의연구원");
    await expect(page.getByLabel("닉네임", { exact: true })).toHaveCount(0);
    expect(server.state().tutorial.completedStepIds).toEqual(["ultimate"]);
    expect(server.calls.some((c: any) => c.method === "updatePlayerCard" && c.status === 200)).toBe(true);
    await page.reload();
    await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
    await tap(page, 540, 1100);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 60000 }).toBe("lobby");
    await expect(page.getByLabel("닉네임", { exact: true })).toHaveCount(0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
