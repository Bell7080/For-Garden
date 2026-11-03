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
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("티아의 보물상자");
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("chest-forge-empty.png"));
  await page.evaluate(async () => {
    const root = "/src/";
    const ui = await import(/* @vite-ignore */root+"ui/ChestForgePopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    ui.openChestHowTo(scene, new layers.PopupLayer(scene, 3100));
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("게임 방법");
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("chest-forge-howto.png"));
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
    s.chestForge = { weekKey: missionPeriodKeys(now).weeklyKey, spent: 300, run: { box: "grand", round: 4, offer: rollChestOffer(4, () => 0.97), collected: { gold: 40_000, gems: 100, cheesecake: 10 } } };
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
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("티아의 보물상자");
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(async () => {
    const art = await import(/* @vite-ignore */"/src/"+"ui/chestArt.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    return art.CHEST_ART_ASSETS.every(([key]: readonly [string, string]) => scene.textures.exists(key))
      && [0, 1, 2, 3, 4].some((grade) => scene.textures.exists(art.chestTextureKey(grade, false)));
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
    const sheet = document.createElement("canvas"); sheet.width = 520 * 4; sheet.height = 480 * 3;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#ffe9dc"; ctx.fillRect(0, 0, sheet.width, sheet.height);
    for (let stage = 0; stage < 5; stage += 1) for (const open of [false, true]) {
      const index = stage * 2 + (open ? 1 : 0);
      const key = art.ensureChestTexture(scene, stage, open);
      ctx.drawImage(scene.textures.get(key).getSourceImage(), (index % 4) * 520, Math.floor(index / 4) * 480);
    }
    return sheet.toDataURL("image/png");
  });
  const fs = await import("node:fs");
  fs.writeFileSync(info.outputPath("chest-sheet.png"), Buffer.from(urls.split(",")[1], "base64"));
});

test("보물상자 — 로비 이벤트 카드", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; });
  await sourceScene(page, "window.__FORGE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window as any).__FORGE_GAME.scene.getScene("lobby").openEvents());
  await page.waitForTimeout(3500);
  await captureGame(page, info.outputPath("chest-forge-lobby-1.png"));
  // 헤드리스는 프레임이 드물어 씬 시계가 거의 흐르지 않는다 — 토리카의 두드리기(2초 주기)를 직접 불러 등급을 올려 본다.
  for (let shot = 2; shot <= 4; shot += 1) {
    await page.evaluate(() => {
      const time = (window as any).__FORGE_GAME.scene.getScene("lobby").time;
      for (const event of time._active) if (event.delay === 2000 && event.loop) event.callback.call(event.callbackScope);
    });
    await page.waitForTimeout(2500);
    await captureGame(page, info.outputPath(`chest-forge-lobby-${shot}.png`));
  }
});
