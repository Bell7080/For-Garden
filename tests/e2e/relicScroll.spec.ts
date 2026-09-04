import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, drag, tap as tapGame, tapUntil } from "./canvasInput";

/** 저장을 통과해 로비에서 도감 탭으로 들어가는 공통 사용자 경로다. */
async function openRelics(page: Page): Promise<void> {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 로비는 이름이 바뀐 뒤에도 하단 탭의 입력면을 마저 만든다 — 될 때까지 다시 누른다.
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.relicScroll)).toBeTruthy();
}

test("소수 보유/다수 미보유 목록은 휠과 드래그를 경계 안에서 멈춘다", async ({ page }) => {
  await openRelics(page);
  const canvas = page.locator("canvas");
  await canvas.hover({ position: { x: 200, y: 400 } });

  // 큰 휠 입력도 콘텐츠 높이로 계산한 최하단을 넘지 않는다.
  await page.mouse.wheel(0, 20_000);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.relicScroll?.y))
    .toBe(await page.evaluate(() => window.__PF_DEBUG?.relicScroll?.minY));

  // 반대 방향 드래그/관성이 끝난 뒤에도 최상단 0을 물리적으로 넘지 않는다.
  await drag(page, [BASE_WIDTH * 0.5, BASE_HEIGHT * 0.55], [BASE_WIDTH * 0.5, BASE_HEIGHT * 0.85], { steps: 8 });
  await page.waitForTimeout(500);
  const scroll = await page.evaluate(() => window.__PF_DEBUG?.relicScroll);
  expect(scroll?.y).toBeLessThanOrEqual(scroll?.maxY ?? 0);
  expect(scroll?.y).toBeGreaterThanOrEqual(scroll?.minY ?? 0);
  await captureGame(page, `test-results/relic-scroll-${test.info().project.name}.png`);
});

test("도감 스크롤 입력은 BottomNav 탭 영역을 가로채지 않는다", async ({ page }) => {
  await openRelics(page);
  // 목록을 먼저 움직여 카드 입력면이 하단에 접근한 상태에서도 로비 탭이 우선한다.
  await page.mouse.wheel(0, 20_000);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});

test("도감 하단 카드는 탭 경계를 침범하지 않는다", async ({ page }) => {
  await openRelics(page);
  // 최하단 카드가 마스크 끝에 접근한 상태를 캡처해 BottomNav 내부로 새는 회귀를 확인한다.
  await page.mouse.wheel(0, 20_000);
  await page.waitForTimeout(150);
  await captureGame(page, `test-results/relic-bottom-fade-${test.info().project.name}.png`);
});
