import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { tap, tapAndWait } from "./canvasInput";
import { LOBBY_MENU_BUTTON, lobbyMenuTrayLayout } from "../../src/ui/lobbyMenuLayout";
import { CODEX_POPUP_LAYOUT } from "../../src/ui/codexPopupLayout";
import { CODEX_RELICS } from "../../src/core/codex";

const WIDTH = 1080; const HEIGHT = 1920;

// 세로 화면 그대로 확인한다(1080×1920 캡처).
test.use({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });

test("로비 메뉴의 도감 칩은 도감 창을 연다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    // 아군 몇과 적 몇을 만난 채로 둬 받을 마디·실루엣이 함께 선다.
    const allies = CODEX_RELICS.filter((relic) => relic.enemyOnly !== true).slice(0, 18).map(({ id }) => id);
    const enemies = CODEX_RELICS.filter((relic) => relic.enemyOnly === true).slice(0, 7).map(({ id }) => id);
    saved.achievements = { claimed: {}, goldPeak: 0, ...saved.achievements, encountered: [...allies, ...enemies] };
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const { chips } = lobbyMenuTrayLayout(3);
  await tap(page, LOBBY_MENU_BUTTON.x, LOBBY_MENU_BUTTON.y);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/${test.info().project.name}-codex-menu.png` });
  await tapAndWait(page, chips[0].x, chips[0].y, () => window.__PF_DEBUG?.popupTitles, ["도감"]);
  // 얼굴 액자는 원화가 도착하는 대로 서므로 잠깐 기다린다.
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `test-results/${test.info().project.name}-codex-ally.png` });
  const { footer, sort } = CODEX_POPUP_LAYOUT;
  // 정렬 줄 — 등급별, 소속별 구역을 차례로 본다.
  for (const [index, name] of [[1, "rarity"], [2, "squad"]] as const) {
    await tap(page, WIDTH / 2 + (index - 1) * (sort.tab.width + sort.tab.gap), HEIGHT / 2 + sort.y);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `test-results/${test.info().project.name}-codex-${name}.png` });
  }
  await tap(page, WIDTH / 2 - (sort.tab.width + sort.tab.gap), HEIGHT / 2 + sort.y);
  await page.waitForTimeout(400);
  await tap(page, WIDTH / 2 + (footer.tab.width + footer.tab.gap) / 2, HEIGHT / 2 + footer.tabY);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `test-results/${test.info().project.name}-codex-enemy.png` });
  await tap(page, WIDTH / 2 + footer.claim.x, HEIGHT / 2 + footer.claim.y);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/${test.info().project.name}-codex-claimed.png` });
});
