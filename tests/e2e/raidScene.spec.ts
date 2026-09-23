import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, waitForDebugState } from "./canvasInput";
import { RAID_ACTIONS } from "../../src/ui/raidLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

/**
 * 레이드는 **시즌 판 → 편성 → 전투** 순서다. 편성은 스토리와 같은 편성 화면(`party`)이 맡는다.
 */
test("레이드는 시즌 판을 먼저 세우고 출격이 공용 편성 화면을 연다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2 + 152); // 레이드
  await expect.poll(() => scene(page)).toBe("raid");
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "season", { timeout: 20_000 });

  // 보스 전신은 ZIP을 내려받아 세우므로 첫 프레임보다 늦게 도착한다. 원화가 붙을 틈을 준다.
  await page.waitForTimeout(4_000);
  await captureGame(page, `test-results/${test.info().project.name}-raid-season.png`);

  // 출격은 전투가 아니라 편성 화면을 연다 — 하루 세 번뿐인 도전이라 누구를 데려갈지 먼저 고른다.
  await tap(page, RAID_ACTIONS.sortie.centerX, RAID_ACTIONS.y);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe("party");
  await page.waitForTimeout(1_500);
  await captureGame(page, `test-results/${test.info().project.name}-raid-party.png`);

  // 편성에서 나가는 길은 로비가 아니라 시즌 판이다.
  await tap(page, 960, BASE_HEIGHT - 120);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe("raid");
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "season", { timeout: 20_000 });
});
