import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";

test("보물상자 팝업 모바일 배치", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  const { applyMissionEvent } = await import("../../src/core/missions");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true; s.missions = applyMissionEvent(s.missions, { type: "stamina_spent", amount: 340 }, new Date()); });
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
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("보물상자");
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("chest-forge-empty.png"));
});

test("보물상자 — 마지막 카드를 고르는 화면", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  const { applyMissionEvent, missionPeriodKeys } = await import("../../src/core/missions");
  const { rollChestOffer } = await import("../../src/core/chestForge");
  const now = new Date();
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => {
    s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true;
    s.missions = applyMissionEvent(s.missions, { type: "stamina_spent", amount: 1340 }, now);
    s.chestForge = { weekKey: missionPeriodKeys(now).weeklyKey, spent: 300, run: { round: 4, offer: rollChestOffer(4, () => 0.97), collected: { gold: 40_000, gems: 100, cheesecake: 10 } } };
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
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("보물상자");
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(async () => {
    const art = await import(/* @vite-ignore */"/src/"+"ui/chestArt.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    return art.CHEST_ART_ASSETS.every(([key]: readonly [string, string]) => scene.textures.exists(key))
      && scene.textures.exists(art.chestTextureKey(7, true));
  });
  expect(loaded).toBe(true);
  await captureGame(page, info.outputPath("chest-forge-cards-open.png"));
});

test("보물상자 — 단계별 상자 그림 원본", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; });
  await sourceScene(page, "window.__FORGE_GAME=this.game;");
  const urls = await page.evaluate(async () => {
    const art = await import(/* @vite-ignore */"/src/"+"ui/chestArt.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScenes(true)[0];
    const sheet = document.createElement("canvas"); sheet.width = 520 * 4; sheet.height = 480 * 4;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#ffe9dc"; ctx.fillRect(0, 0, sheet.width, sheet.height);
    for (let stage = 0; stage < 8; stage += 1) for (const open of [false, true]) {
      const index = stage * 2 + (open ? 1 : 0);
      const key = art.ensureChestTexture(scene, stage, open);
      ctx.drawImage(scene.textures.get(key).getSourceImage(), (index % 4) * 520, Math.floor(index / 4) * 480);
    }
    return sheet.toDataURL("image/png");
  });
  const fs = await import("node:fs");
  fs.writeFileSync(info.outputPath("chest-sheet.png"), Buffer.from(urls.split(",")[1], "base64"));
});
