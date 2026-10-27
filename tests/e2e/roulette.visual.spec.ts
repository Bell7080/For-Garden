import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap, tapUntil } from "./canvasInput";

test("돌림판 팝업 모바일 배치와 무료 회전 지급", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  // 움직임 줄이기로 연다 — 바퀴가 곧바로 멈춰 서므로 소프트웨어 렌더(2fps)에서도 지급 흐름을 끝까지 본다.
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; s.settings.accessibility.reduceMotion = true; });
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
  }), { timeout: 30000 }).toBe(true);
  await captureGame(page, info.outputPath("roulette-before.png"));
  await tapUntil(page, 540, 1440, () => page.evaluate(() => (window.__PF_DEBUG?.popupTitles ?? []).includes("돌림판 보상")), { gapMs: 10000 });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles), { timeout: 60000 }).toContain("돌림판 보상");
  await captureGame(page, info.outputPath("roulette-reward.png"));
  await tap(page, 540, 1770);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("돌림판 보상");
  await captureGame(page, info.outputPath("roulette-ad-button.png"));
  await tapUntil(page, 540, 1440, () => page.evaluate(() => (window.__PF_DEBUG?.popupTitles ?? []).includes("돌림판 보상")), { gapMs: 10000 });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? []), { timeout: 60000 }).toContain("돌림판 보상");
  await tap(page, 540, 1770);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("돌림판 보상");
  await captureGame(page, info.outputPath("roulette-after-ad-spin.png"));
});

test("돌림판 확률 정보와 이벤트 카드의 반쯤 솟은 바퀴", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => { s.settings.game.language = "ko"; });
  await sourceScene(page, "window.__ROULETTE_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.evaluate(async () => {
    const root = "/src/";
    const rates = await import(/* @vite-ignore */root+"ui/RouletteRatesPopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const scene = (window as any).__ROULETTE_GAME.scene.getScene("lobby");
    rates.openRouletteRates(scene, new layers.PopupLayer(scene, 3000));
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("확률 정보");
  await captureGame(page, info.outputPath("roulette-rates.png"));
  await page.evaluate(async () => {
    const root = "/src/";
    const events = await import(/* @vite-ignore */root+"ui/LobbyEventPopup.ts");
    const layers = await import(/* @vite-ignore */root+"ui/PopupLayer.ts");
    const scene = (window as any).__ROULETTE_GAME.scene.getScene("lobby");
    new events.LobbyEventPopup(scene, new layers.PopupLayer(scene, 4000), { onSelect: () => {} }).open();
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("이벤트");
  await page.waitForTimeout(8000);
  await captureGame(page, info.outputPath("roulette-event-card.png"));
});
