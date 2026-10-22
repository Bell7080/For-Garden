import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap } from "./canvasInput";

test("돌림판 팝업 모바일 배치와 무료 회전 지급", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; });
  await sourceScene(page, "window.__ROULETTE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.evaluate(async () => {
    const root = "/src/";
    const ui = await import(/* @vite-ignore */root+"ui/RoulettePopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const game = (window as any).__ROULETTE_GAME;
    const scene = game.scene.getScene("lobby");
    await ui.openRoulettePopup(scene, new layers.PopupLayer(scene, 3000), () => {});
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("행운의 돌림판");
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as any).__ROULETTE_GAME?.scene.getScene("lobby");
    return scene?.children.getByName("roulette-meron")?.visible === true;
  })).toBe(true);
  await captureGame(page, info.outputPath("roulette-before.png"));
  await tap(page, 540, 1345);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles), { timeout: 60000 }).toContain("돌림판 보상");
  await captureGame(page, info.outputPath("roulette-reward.png"));
  await tap(page, 540, 1770);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("돌림판 보상");
  await captureGame(page, info.outputPath("roulette-ad-button.png"));
  await tap(page, 540, 1310);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? []), { timeout: 60000 }).toContain("돌림판 보상");
  await tap(page, 540, 1770);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("돌림판 보상");
  await captureGame(page, info.outputPath("roulette-after-ad-spin.png"));
});
