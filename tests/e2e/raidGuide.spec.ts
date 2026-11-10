import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, waitForDebugState } from "./canvasInput";
import { RAID_BOSS_PICK, RAID_DIFFICULTY_PICK, RAID_GUIDE_BUTTON, RAID_LIST_CHROME, raidBossPickHeight, raidPickHeight } from "../../src/ui/raidLayout";
import { RAID_BOSS_POOL } from "../../src/data/raid";
import { getRelic } from "../../src/data/relics";
import { sortieEntryScreenPoint } from "../../src/ui/sortieMenuLayout";

const RAID_ENTRY = sortieEntryScreenPoint("raid");
const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

const titles = (page: Page) => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? []);

/**
 * 세 보스마다 시즌 판의 「공략법!」 버튼을 눌러 창을 열고, 추천 렐릭의 이유를 펼쳐 본다.
 * 보스는 선택 소환으로 하나씩 세운다 — 월드 폭주는 하루 한 마리라 셋을 다 볼 수 없다.
 */
test("레이드 공략법 창은 보스마다 패턴·상성·추천 이유를 연다", async ({ page }) => {
  test.setTimeout(240_000);
  // 보스 셋을 모두 세울 만큼 선택 토벌권을 쥐고 시작한다.
  await startAfterOpening(page, (state) => {
    state.itemInventory = [...state.itemInventory.filter((stack) => stack.itemId !== "raid-select-ticket"), { itemId: "raid-select-ticket", quantity: 5 }];
  });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245);
  await expect.poll(() => titles(page)).toContain("출격");
  await tap(page, RAID_ENTRY.x, RAID_ENTRY.y);
  await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "list", { timeout: 20_000 });
  await page.waitForTimeout(2_000);

  const project = test.info().project.name;
  for (const [index, bossId] of RAID_BOSS_POOL.entries()) {
    await tap(page, RAID_LIST_CHROME.summon.select.centerX, RAID_LIST_CHROME.summon.y);
    await expect.poll(() => titles(page)).toContain("선택 소환");
    await page.waitForTimeout(1_000);
    const pickTop = BASE_HEIGHT / 2 - raidBossPickHeight(RAID_BOSS_POOL.length) / 2 + RAID_BOSS_PICK.top;
    await tap(page, BASE_WIDTH / 2 - 200, pickTop + RAID_BOSS_PICK.height / 2 + index * (RAID_BOSS_PICK.height + RAID_BOSS_PICK.gap));
    await expect.poll(() => titles(page)).toContain(getRelic(bossId).name);
    await page.waitForTimeout(1_000);
    const difficultyHeight = raidPickHeight(RAID_DIFFICULTY_PICK, 3);
    await tap(page, BASE_WIDTH / 2 - 200, BASE_HEIGHT / 2 - difficultyHeight / 2 + RAID_DIFFICULTY_PICK.top + RAID_DIFFICULTY_PICK.height / 2);
    await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "summonReveal", { timeout: 40_000 });
    await page.waitForTimeout(800);
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "season", { timeout: 20_000 });
    await page.waitForTimeout(2_000);
    await captureGame(page, `test-results/${project}-raid-guide-${bossId}-season.png`);

    await tap(page, RAID_GUIDE_BUTTON.x, RAID_GUIDE_BUTTON.y);
    await expect.poll(() => titles(page)).toContain("공략법");
    await page.waitForTimeout(1_500);
    await captureGame(page, `test-results/${project}-raid-guide-${bossId}.png`);
    const why = await page.evaluate(() => window.__PF_DEBUG?.raidGuideWhy);
    expect(why).toBeTruthy();
    await tap(page, why!.x, why!.y);
    await page.waitForTimeout(1_500);
    await captureGame(page, `test-results/${project}-raid-guide-${bossId}-why.png`);
    await tap(page, 960, BASE_HEIGHT - 120); // 창 닫기
    await expect.poll(() => titles(page)).not.toContain("공략법");
    await tap(page, 960, BASE_HEIGHT - 120); // 판에서 목록으로
    await waitForDebugState(page, () => window.__PF_DEBUG?.raidStage, "list", { timeout: 20_000 });
    await page.waitForTimeout(1_500);
  }
});
