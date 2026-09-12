import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

test("적을 누르면 정보창을 줄인 팝업이 열린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tap(page, BASE_WIDTH / 2, 550); // 스토리
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 미리보기 SD가 실제로 붙은 뒤에 누른다 — 판이 비동기로 그려지기 때문이다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview?.enemyTargets?.length ?? 0), { timeout: 60_000 }).toBeGreaterThan(0);
  const target = (await page.evaluate(() => window.__PF_DEBUG!.enemyPreview!.enemyTargets[0]))!;
  await tap(page, target.x, target.y);

  // 머리글은 개체 이름이 아니라 "정보창"이다 — 이름은 판 안의 이름 블록이 말한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles), { timeout: 20_000 }).toContain("정보창");
  // 원화·SD가 도착할 틈을 두고 찍는다.
  await page.waitForTimeout(1500);
  await captureGame(page, `test-results/${test.info().project.name}-enemy-info.png`);

  // 능력치 칸의 돋보기는 정보창의 그것과 **같은 함수**가 연다. 창 위에 창이 쌓이는지까지 본다.
  await tap(page, 891, 839);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["정보창", "능력치 상세"]);
  await tap(page, 540, 300);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["정보창"]);

  // 스킬 액자를 누르면 아군 창과 같은 쪽지가 그 위에 뜬다.
  await tap(page, BASE_WIDTH / 2 - 8, BASE_HEIGHT / 2 + 424);
  await page.waitForTimeout(700);
  await captureGame(page, `test-results/${test.info().project.name}-enemy-skill.png`);
});
