import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";

test("보물상자 대장간 팝업 모바일 배치", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true; });
  await sourceScene(page, "window.__FORGE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const open = () => page.evaluate(async () => {
    const root = "/src/";
    const ui = await import(/* @vite-ignore */root+"ui/ChestForgePopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    await ui.openChestForgePopup(scene, new layers.PopupLayer(scene, 3000), () => {});
  });
  await open();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("보물상자 대장간");
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("chest-forge-empty.png"));
});

test("보물상자 대장간 — 4단계 상자를 든 화면", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  const { applyMissionEvent, missionPeriodKeys } = await import("../../src/core/missions");
  const now = new Date();
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => {
    s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true;
    s.missions = applyMissionEvent(s.missions, { type: "stamina_spent", amount: 1340 }, now);
    s.chestForge = { weekKey: missionPeriodKeys(now).weeklyKey, spent: 200, stage: 4 };
  });
  await sourceScene(page, "window.__FORGE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.evaluate(async () => {
    const root = "/src/";
    const ui = await import(/* @vite-ignore */root+"ui/ChestForgePopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    await ui.openChestForgePopup(scene, new layers.PopupLayer(scene, 3000), () => {});
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("보물상자 대장간");
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("chest-forge-stage4.png"));
});
