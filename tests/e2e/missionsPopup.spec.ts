import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const WIDTH = 1080; const HEIGHT = 1920;

/** 기준 게임 좌표를 FIT 캔버스 안의 실제 클릭 좌표로 바꾼다. */
async function tap(page: import("@playwright/test").Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas"); const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({ position: { x: x / WIDTH * box.width, y: y / HEIGHT * box.height } });
}

test("임무 버튼은 로비 씬을 유지한 채 공용 팝업을 연다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 오른쪽 레일의 임무 입력점은 기존 레일 배치를 그대로 사용한다.
  await tap(page, WIDTH - 106, 1248);
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${test.info().project.name}-missions-popup.png`, fullPage: true });
});
