import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const WIDTH = 1080; const HEIGHT = 1920;

/** 기준 게임 좌표를 FIT 캔버스 안의 실제 클릭 좌표로 바꾼다. */
async function tap(page: import("@playwright/test").Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas"); const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({ position: { x: x / WIDTH * box.width, y: y / HEIGHT * box.height } });
}

test("임무 버튼은 로비 씬을 유지하고 일일·주간 탭을 각각 렌더링한다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    // FIT 모바일 캡처에서 마지막 수령 가능 액자가 가장 밝게 드러나도록 양쪽 연구도를 최대로 둔다.
    saved.missions.researchPoints = { daily: 120, weekly: 120 };
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 오른쪽 레일의 임무 입력점은 기존 레일 배치를 그대로 사용한다.
  await tap(page, WIDTH - 106, 1248);
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForTimeout(300);
  // 일일 탭의 연구도와 네 장 목록을 첫 번째 시각 회귀 자료로 남긴다.
  await tap(page, WIDTH / 2 - 245, HEIGHT / 2 - 665);
  await page.screenshot({ path: `test-results/${test.info().project.name}-missions-popup-daily.png`, fullPage: true });
  // 같은 팝업에서 주간 탭을 골라 연구도 액자와 짧은 목록의 별도 배치도 검증한다.
  await tap(page, WIDTH / 2 + 245, HEIGHT / 2 - 665);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `test-results/${test.info().project.name}-missions-popup-weekly.png`, fullPage: true });
});
