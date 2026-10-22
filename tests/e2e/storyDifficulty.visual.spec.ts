import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap } from "./canvasInput";

test("스토리 난이도 선택 · 원본 코마 정예 · 전투 SUB · 해금 축하 · 재접속", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, state => {
    state.settings.game.language = "ko";
    for (let chapter = 1; chapter <= 4; chapter++) for (let order = 1; order <= 10; order++) state.cleared.add(`${chapter}-${order}`);
    for (let order = 1; order < 10; order++) state.cleared.add(`normal:1-${order}`);
    state.selectedStageId = "1-1";
  });
  await sourceScene(page, "window.__STORY_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('stageMap');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tap(page, 180, 200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("난이도 선택");
  await captureGame(page, info.outputPath("difficulty-picker.png"));
  // 어려움은 보통 4-10을 완료하기 전에는 선택할 수 없다.
  await tap(page, 540, 1185);
  expect(await page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").difficulty)).toBe("easy");
  await tap(page, 540, 985);
  await expect.poll(() => page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").selected)).toBe("normal:1-10");
  expect(await page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").chapterStages(1).map((s: any) => s.kind))).toEqual(Array(11).fill("battle"));
  const koma = await page.evaluate(async () => { const root = "/src/"; const stages = await import(/* @vite-ignore */root+"data/stages.ts"); const stage = stages.getBattleStage("normal:1-10"); return { ids: stage.enemies.map((e: any) => e.relicId), elite: stage.elite }; });
  expect(koma).toEqual({ ids: ["koma"], elite: true });
  await captureGame(page, info.outputPath("normal-koma-map.png"));
  await page.evaluate(async () => {
    const root = "/src/";
    const [state, api, ui, layers] = await Promise.all([import(/* @vite-ignore */root+"state/session.ts"), import(/* @vite-ignore */root+"api/FakeServer.ts"), import(/* @vite-ignore */root+"ui/StoryDifficultyPopup.ts"), import(/* @vite-ignore */root+"ui/PopupLayer.ts")]);
    for (let chapter = 1; chapter <= 4; chapter++) for (let order = 1; order <= 10; order++) if (chapter !== 4 || order !== 10) state.session.cleared.add(`normal:${chapter}-${order}`);
    const result = await api.gameApi.completeStage("normal:4-10", true);
    const scene = (window as any).__STORY_GAME.scene.getScene("stageMap");
    void ui.openStoryDifficultyUnlocked(scene, new layers.PopupLayer(scene, 3000), result.unlockedStoryDifficulty);
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("새로운 난이도가 열렸어요!");
  await captureGame(page, info.outputPath("hard-unlocked.png"));
  await tap(page, 540, 1205);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("새로운 난이도가 열렸어요!");
  await tap(page, 180, 200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("난이도 선택");
  await tap(page, 540, 1185);
  await expect.poll(() => page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").selected)).toBe("hard:1-1");
  await captureGame(page, info.outputPath("hard-map.png"));
  await page.reload();
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await sourceScene(page, "window.__STORY_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('stageMap');");
  await expect.poll(() => page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").difficulty)).toBe("hard");
});
