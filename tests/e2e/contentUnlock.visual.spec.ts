import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { normalizePlayerLevel } from "../../src/core/playerLevel";
import { LOBBY_ACTION_BOUNDS } from "../../src/ui/lobbyLayout";

const WIDTH = 1080; const HEIGHT = 1920;

/**
 * 레벨 2 → 3에서 상점·무역·대작전·현상수배가 함께 열린 로비 — 자물쇠가 풀리고 「NEW」가 서며, 출격 버튼이 판 안의 새 콘텐츠를 알린다.
 * 출격 판을 열면 그 칸의 덮개가 풀리고 NEW가 남는다.
 */
test("새로 열린 콘텐츠는 풀리는 연출 뒤에 들를 때까지 NEW를 단다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    saved.playerResearch = normalizePlayerLevel({ level: 3 });
    saved.playerCard.uid = "123456789";
    saved.settings.game.contentSeen = { owner: "123456789", known: ["excavation"], fresh: [] };
  });
  const name = test.info().project.name;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForTimeout(2500);
  await captureGame(page, `test-results/${name}-unlock-1-mid.png`);
  await page.waitForTimeout(4000);
  await captureGame(page, `test-results/${name}-unlock-2-toast.png`);
  await page.waitForTimeout(6000);
  await captureGame(page, `test-results/${name}-unlock-3-sortie.png`);
  await page.waitForTimeout(6000);
  await tap(page, LOBBY_ACTION_BOUNDS.sortie.x, LOBBY_ACTION_BOUNDS.sortie.y);
  await page.waitForTimeout(2500);
  await captureGame(page, `test-results/${name}-unlock-4-panel-mid.png`);
  await page.waitForTimeout(6000);
  await captureGame(page, `test-results/${name}-unlock-5-panel.png`);
  expect(errors.filter((e) => !/net::|Failed to load|ERR_/.test(e))).toEqual([]);
});
