import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";

async function openShute(page: import("@playwright/test").Page): Promise<void> {
  await sourceScene(page, "window.__FORGE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.evaluate(async () => {
    const root = "/src/";
    const ui = await import(/* @vite-ignore */root+"ui/ShuteFishingPopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    await ui.openShuteFishingPopup(scene, new layers.PopupLayer(scene, 3000), () => {});
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("슈테의 리듬 낚시");
  await page.waitForTimeout(1500);
}

test("리듬 낚시 — 난이도 고르는 첫 쪽", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  const { applyMissionEvent } = await import("../../src/core/missions");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true; s.missions = applyMissionEvent(s.missions, { type: "stamina_spent", amount: 340 }, new Date()); });
  await openShute(page);
  await captureGame(page, info.outputPath("shute-fishing-intro.png"));
});

test("리듬 낚시 — 진행 중인 판", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  const { applyMissionEvent, missionPeriodKeys } = await import("../../src/core/missions");
  const { fishingDifficulty, rollFishCatches, rollFishingFish } = await import("../../src/core/shuteFishing");
  const now = new Date();
  const difficulty = fishingDifficulty("extreme")!;
  let seed = 7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  const fish = rollFishingFish(difficulty, random);
  const catches = fish.map((id) => rollFishCatches(difficulty, id, random));
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => {
    s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true;
    s.missions = applyMissionEvent(s.missions, { type: "stamina_spent", amount: 1340 }, now);
    s.shuteFishing = { weekKey: missionPeriodKeys(now).weeklyKey, spent: 400, run: { difficulty: "extreme", fish, catches, index: 2, caught: 1, misses: 1, collected: { gold: 25_000, gems: 100 } } };
  });
  await openShute(page);
  await captureGame(page, info.outputPath("shute-fishing-run.png"));
});

test("리듬 낚시 — 로비 이벤트 카드", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; });
  await sourceScene(page, "window.__FORGE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await page.waitForFunction(() => window.__PF_DEBUG?.scene === "lobby");
  await page.evaluate(async () => {
    const root = "/src/";
    const cards = await import(/* @vite-ignore */root + "ui/LobbyEventCard.ts");
    const events = await import(/* @vite-ignore */root + "data/lobbyEvents.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    scene.add.rectangle(540, 960, 1080, 1920, 0x05070a, 0.85).setDepth(4000);
    const event = events.findLobbyEvent("shute-fishing");
    const card = new cards.LobbyEventCard(scene, 540, 860, { width: 960, height: 300, entry: { kind: "event", event }, now: Date.now(), onClick: () => {} });
    scene.add.existing(card); card.setDepth(4001);
  });
  await page.waitForTimeout(5000);
  await captureGame(page, info.outputPath("shute-lobby-card.png"));
});
