import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";

/** 수호전 결과판의 성적 블록(막대 셋 + 오늘 길드원 순위) 캡처 — 눈으로 대조하기 위한 캡처 전용이다(Vite test 소스 모드에서만). */
test.use({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });

test("수호전 결과판 성적 블록 캡처", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; });
  await sourceScene(page, "window.__GUARD_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const open = (name: string, sample: string) => page.evaluate(async (raw) => {
    const root = "/src/";
    const R = await import(/* @vite-ignore */root + "core/guildGuardReport.ts");
    const P = await import(/* @vite-ignore */root + "ui/PopupLayer.ts");
    const S = await import(/* @vite-ignore */root + "ui/StageCompletePopup.ts");
    const I = await import(/* @vite-ignore */root + "ui/priceTag.ts");
    const scene = (window as any).__GUARD_GAME.scene.getScene("lobby");
    const o = JSON.parse(raw);
    (window as any).__guardPopups?.closeAll?.();
    const popups = new P.PopupLayer(scene, 2400);
    (window as any).__guardPopups = popups;
    new S.StageCompletePopup(scene, popups).open({
      reward: { kind: "loot", items: [{ icon: I.GUILD_COIN_ICON, amount: o.coin }], settlement: true },
      guardReport: R.buildGuardReport(o.input),
      fighters: [{ relicId: "torika", isMvp: false }, { relicId: "dodi", isMvp: true }, { relicId: "parua", isMvp: false }],
      onOpenContribution: (done: () => void) => done(),
    });
  }, sample).then(async () => { await page.waitForTimeout(3500); await page.screenshot({ path: info.outputPath(name), scale: "device" }); });
  const board = (me: number, myScore: number) => ({ guildRank: 3, members: [
    { rank: 1, name: "라이벌", score: 12480, isMe: false }, { rank: 2, name: "새벽감시자", score: 10920, isMe: false },
    { rank: 3, name: "화석덕후", score: 9310, isMe: false }, { rank: 4, name: "치즈케이크", score: 8600, isMe: false },
    { rank: me, name: "나", score: myScore, isMe: true }, { rank: me + 1, name: "느긋한연구원", score: 5200, isMe: false },
  ] });
  await open("01-guard-climbed.png", JSON.stringify({ coin: 20, input: { outcome: { score: 8140, waves: 15, kills: 79 }, best: 8140, before: { ...board(6, 6100), guildRank: 3 }, after: board(5, 8140) } }));
  await open("02-guard-top3.png", JSON.stringify({ coin: 32, input: { outcome: { score: 4200, waves: 9, kills: 41 }, best: 11200, before: { guildRank: 2, members: [{ rank: 1, name: "라이벌", score: 12480, isMe: false }, { rank: 2, name: "나", score: 11200, isMe: true }, { rank: 3, name: "화석덕후", score: 9310, isMe: false }] }, after: { guildRank: 2, members: [{ rank: 1, name: "라이벌", score: 12480, isMe: false }, { rank: 2, name: "나", score: 11200, isMe: true }, { rank: 3, name: "화석덕후", score: 9310, isMe: false }] } } }));
  await open("03-guard-no-board.png", JSON.stringify({ coin: 12, input: { outcome: { score: 2600, waves: 6, kills: 22 }, best: 2600, before: null, after: null } }));
});
