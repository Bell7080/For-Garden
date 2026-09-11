import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

test("노드 미리보기가 관문 상황 한 줄을 제목 아래에 세운다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tap(page, BASE_WIDTH / 2, 550); // 스토리
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 판은 SD를 읽어 오므로 실제로 붙을 때까지 기다린 뒤 찍는다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview !== undefined), { timeout: 60_000 }).toBe(true);
  const panel = (await page.evaluate(() => window.__PF_DEBUG!.enemyPreview!))!;
  // 판 전체가 지도 창 안에 남아 한 줄이 늘어도 가장자리로 넘치지 않는다.
  expect(panel.panelTop).toBeGreaterThanOrEqual(panel.top);
  expect(panel.panelBottom).toBeLessThanOrEqual(panel.bottom);

  await captureGame(page, `test-results/${test.info().project.name}-stage-situation.png`);
});
