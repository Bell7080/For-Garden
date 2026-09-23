import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, waitForDebugState } from "./canvasInput";
import { RAID_ACTIONS, RAID_BOSS_SPOT, RAID_LIST_CHROME, raidLayerStack } from "../../src/ui/raidLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

/**
 * 레이드는 **시즌 판 → 편성 → 전투** 순서다. 편성은 스토리와 같은 편성 화면(`party`)이 맡는다.
 */
test("레이드는 목록에서 월드 폭주 판으로 들어가고 출격이 공용 편성 화면을 연다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2 + 152); // 레이드
  await expect.poll(() => scene(page)).toBe("raid");
  // 레이드는 먼저 **목록**을 연다 — 맨 위가 오늘의 월드 폭주 층이다.
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "list", { timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await captureGame(page, `test-results/${test.info().project.name}-raid-list.png`);
  // 소환은 난이도를 고르는 창을 연다.
  await tap(page, RAID_LIST_CHROME.summon.pair.left.centerX, RAID_LIST_CHROME.summon.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("레이드 소환");
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${test.info().project.name}-raid-summon.png`);
  await tap(page, 40, 200); // 판 밖을 눌러 닫는다
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("레이드 소환");
  // 선택 소환 — 보스를 층으로 고르고, 난이도를 고르면 소환 연출이 돈다.
  await tap(page, RAID_LIST_CHROME.summon.pair.right.centerX, RAID_LIST_CHROME.summon.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("선택 소환");
  await page.waitForTimeout(1_500);
  await captureGame(page, `test-results/${test.info().project.name}-raid-boss-pick.png`);
  await tap(page, BASE_WIDTH / 2 - 200, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("선택 소환");
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${test.info().project.name}-raid-difficulty.png`);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2 - 117); // 첫 줄(쉬움) — 창 높이 474의 위에서 120
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "summon", { timeout: 20_000 });
  await page.waitForTimeout(350);
  await captureGame(page, `test-results/${test.info().project.name}-raid-summon-charge.png`);
  await page.waitForTimeout(2_000);
  await captureGame(page, `test-results/${test.info().project.name}-raid-summon-reveal.png`);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "season", { timeout: 20_000 });
  await page.waitForTimeout(1_500);
  await tap(page, 960, BASE_HEIGHT - 120); // 판에서 목록으로
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "list", { timeout: 20_000 });
  await page.waitForTimeout(2_000);
  await captureGame(page, `test-results/${test.info().project.name}-raid-list-summoned.png`);
  // 완료 탭 — 끝난 판을 정산하는 자리다.
  const tabs = RAID_LIST_CHROME.tabs;
  await tap(page, tabs.left + tabs.width * 1.5 + tabs.gap, tabs.y);
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "list", { timeout: 20_000 });
  await page.waitForTimeout(1_500);
  await captureGame(page, `test-results/${test.info().project.name}-raid-completed.png`);
  await tap(page, tabs.left + tabs.width / 2, tabs.y);
  await page.waitForTimeout(1_500);
  // 맨 위 층(월드 폭주)의 이름 줄을 누른다 — 보상 줄의 버튼을 피한다.
  await tap(page, BASE_WIDTH / 2, raidLayerStack(["world"]).centers[0]! - 120);
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "season", { timeout: 20_000 });

  // 보스 전신은 ZIP을 내려받아 세우므로 첫 프레임보다 늦게 도착한다. 원화가 붙을 틈을 준다.
  await page.waitForTimeout(4_000);
  await captureGame(page, `test-results/${test.info().project.name}-raid-season.png`);

  // 보스 원화가 곧 적 정보창의 입구다 — 출격 전에 스킬·능력치를 들여다본다.
  await tap(page, BASE_WIDTH / 2, (RAID_BOSS_SPOT.tap.top + RAID_BOSS_SPOT.tap.bottom) / 2);
  // 원화·SD는 ZIP을 내려받아 세우므로 판이 뜨기까지 틈을 준다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles), { timeout: 15_000 }).toContain("정보창");
  await page.waitForTimeout(2_500);
  await captureGame(page, `test-results/${test.info().project.name}-raid-boss-info.png`);
  await tap(page, 960, BASE_HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("정보창");

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
