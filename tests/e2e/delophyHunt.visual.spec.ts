import { test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";

const open = (page: import("@playwright/test").Page) => page.evaluate(async () => {
  const root = "/src/";
  const ui = await import(/* @vite-ignore */root + "ui/DelophyHuntPopup.ts");
  const layers = await import(/* @vite-ignore */root + "ui/PopupLayer.ts");
  const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
  await ui.openDelophyHuntPopup(scene, new layers.PopupLayer(scene, 3000), () => {});
});

const setup = async (page: import("@playwright/test").Page, withRun: boolean) => {
  const { applyMissionEvent, missionPeriodKeys } = await import("../../src/core/missions");
  const { rollHuntPairs, rollHuntLayout, HUNT_DIFFICULTIES } = await import("../../src/core/delophyHunt");
  const now = new Date();
  const random = () => 0.37;
  const pairs = rollHuntPairs(HUNT_DIFFICULTIES[2], random);
  const layout = rollHuntLayout(pairs, random);
  const firstId = layout[0];
  const found = layout.map((id, slot) => (id === firstId ? slot : -1)).filter((slot) => slot >= 0);
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => {
    s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true;
    s.missions = applyMissionEvent(s.missions, { type: "stamina_spent", amount: 1340 }, now);
    s.delophyHunt = { weekKey: missionPeriodKeys(now).weeklyKey, spent: 0, run: withRun ? { difficulty: "hard", pairs, layout, found, misses: 1, first: null, collected: { gold: 8000 } } : null };
  });
  await sourceScene(page, "window.__FORGE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await page.waitForFunction(() => window.__PF_DEBUG?.scene === "lobby");
  await open(page);
  await page.waitForTimeout(3000);
};

test("델로피의 보물 찾기 — 난이도 고르기", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await setup(page, false);
  await captureGame(page, info.outputPath("delophy-intro.png"));
});

test("델로피의 보물 찾기 — 진행 중 판", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await setup(page, true);
  await captureGame(page, info.outputPath("delophy-play.png"));
});

test("델로피의 보물 찾기 — 게임 방법", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await setup(page, false);
  await page.evaluate(async () => {
    const root = "/src/";
    const ui = await import(/* @vite-ignore */root + "ui/DelophyHuntPopup.ts");
    const layers = await import(/* @vite-ignore */root + "ui/PopupLayer.ts");
    const scene = (window as any).__FORGE_GAME.scene.getScene("lobby");
    ui.openDelophyHowTo(scene, new layers.PopupLayer(scene, 3100));
  });
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("delophy-howto.png"));
});
