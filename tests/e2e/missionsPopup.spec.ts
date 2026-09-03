import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";

const WIDTH = 1080; const HEIGHT = 1920;

test("임무 버튼은 로비 씬을 유지하고 일일·주간 탭을 각각 렌더링한다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    // FIT 모바일 캡처에서 마지막 수령 가능 액자가 가장 밝게 드러나도록 양쪽 연구도를 최대로 둔다.
    saved.missions.researchPoints = { daily: 120, weekly: 120 };
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 오른쪽 콘텐츠 레일의 최상단으로 이동한 임무 진입점을 누른다.
  await tap(page, WIDTH - 106, 640);
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForTimeout(300);
  // 일일 탭의 연구도와 네 장 목록을 첫 번째 시각 회귀 자료로 남긴다.
  await tap(page, WIDTH / 2 - 245, HEIGHT / 2 - 665);
  await captureGame(page, `test-results/${test.info().project.name}-missions-popup-daily.png`);
  // 같은 팝업에서 주간 탭을 골라 연구도 액자와 짧은 목록의 별도 배치도 검증한다.
  await tap(page, WIDTH / 2 + 245, HEIGHT / 2 - 665);
  await page.waitForTimeout(100);
  await captureGame(page, `test-results/${test.info().project.name}-missions-popup-weekly.png`);
});
