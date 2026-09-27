import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

function panel(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.enemyPreview);
}

/*
 * 스토리 관문의 미리보기 — 적 정보·줄거리를 여닫는 두 칸과 맨 아래 초회 보상 한 줄.
 * 칸 머리줄을 누르면 판 높이가 바뀌고, 판은 여전히 지도 창 안에 든다.
 */
test("스토리 미리보기는 줄거리 칸을 펼치고 초회 보상을 판 아래에 세운다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    for (const id of ["1-1", "1-2", "1-3", "1-4"]) session.cleared.add(id);
  });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");
  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tap(page, BASE_WIDTH / 2, 550); // 스토리
  await expect.poll(() => scene(page)).toBe("stageMap");

  await expect.poll(async () => (await panel(page)) !== undefined, { timeout: 60_000 }).toBe(true);
  // SD가 서는 시간을 준다.
  await page.waitForTimeout(1500);
  const closed = (await panel(page))!;
  expect(closed.panelTop).toBeGreaterThanOrEqual(closed.top);
  expect(closed.panelBottom).toBeLessThanOrEqual(closed.bottom);
  await captureGame(page, `test-results/${test.info().project.name}-stage-preview-closed.png`);

  // 줄거리 머리줄 = 판 윗변 + 제목(92) + 적 머리줄(78) + 펼친 적 칸(364) + 줄거리 머리줄의 절반(30).
  await tap(page, BASE_WIDTH / 2, closed.panelTop + 92 + 78 + 364 + 30);
  await expect.poll(async () => (await panel(page))!.panelBottom - (await panel(page))!.panelTop).toBeGreaterThan(closed.panelBottom - closed.panelTop);
  const open = (await panel(page))!;
  expect(open.panelTop).toBeGreaterThanOrEqual(open.top);
  expect(open.panelBottom).toBeLessThanOrEqual(open.bottom);
  await page.waitForTimeout(400);
  await captureGame(page, `test-results/${test.info().project.name}-stage-preview-story.png`);

  // 적 정보 칸을 접으면 누를 적이 사라진다.
  await tap(page, BASE_WIDTH / 2, open.panelTop + 92 + 39);
  await expect.poll(async () => (await panel(page))!.enemyTargets.length).toBe(0);
  await page.waitForTimeout(400);
  await captureGame(page, `test-results/${test.info().project.name}-stage-preview-folded.png`);
});
