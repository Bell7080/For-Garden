import { expect, test, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { engraveRune, enhanceRune, generateRune, runeBatchEnhancementTargets } from "../../src/core/runes";
import { RESEARCH_SHIFT_X, researchSlotCenter } from "../../src/ui/researchBenchLayout";
import { runeSynthesisVertices } from "../../src/ui/runeSynthesisLayout";
import { runePickerListTop, RUNE_PICK_GRID } from "../../src/ui/runePickerLayout";
import { runeSelectFooterXs, runeSelectRows } from "../../src/ui/runeSelectLayout";

/**
 * 특성 연구·합성의 룬 고르기 판 — 카드를 누르면 위 정보 판에 서고, 「선택」을 눌러야 칸에 들어간다.
 * 합성은 넣은 뒤 판을 닫지 않고 다음 빈 칸으로 이어진다.
 */

const scene = (page: Page): Promise<string | undefined> => page.evaluate(() => window.__PF_DEBUG?.scene);
const popupCount = async (page: Page): Promise<number> => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length;

/** 판 가운데 기준 n번째 카드의 화면 자리(판은 화면 가운데에 선다). */
function cardSpot(total: number, order: number): { x: number; y: number } {
  const rows = runeSelectRows(total);
  const g = RUNE_PICK_GRID;
  return {
    x: BASE_WIDTH / 2 - ((g.columns - 1) * g.cellWidth) / 2 + (order % g.columns) * g.cellWidth,
    y: BASE_HEIGHT / 2 + rows.gridTop + runePickerListTop() + g.cellHeight / 2 + Math.floor(order / g.columns) * g.cellHeight,
  };
}
function selectSpot(total: number, slots: number): { x: number; y: number } {
  const rows = runeSelectRows(total);
  return { x: BASE_WIDTH / 2 + runeSelectFooterXs(rows.width, slots).button, y: BASE_HEIGHT / 2 + rows.footerY };
}

test("특성 연구·합성 — 눌러 보고 선택해 넣는다", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await startAfterOpening(page, (session) => {
    session.cleared.add("1-10"); session.archaeology.lastSelectedSiteId = "garden-gate";
    session.wallet.gold = 2_000_000;
    let seed = 0.37;
    const random = () => { seed = (seed * 9301 + 0.49297) % 1; return seed; };
    for (let index = 0; index < 6; index += 1) {
      const rune = generateRune({ instanceId: `pick-${index}`, baseName: "rune", rarity: index < 4 ? "rare" : "epic", part: (index % 3) as 0 | 1 | 2, random });
      // 합성 재료가 되도록 세공·각인을 마친 것으로 둔다.
      let done = rune;
      for (const key of runeBatchEnhancementTargets(rune)) done = enhanceRune(done, key, 1, 0.5);
      session.runeInventory.push(engraveRune(done, { statKey: done.mainStats[0].key, valueAdded: 1 }));
    }
  });
  await expect.poll(async () => { if ((await scene(page)) === "title") await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2); return scene(page); }, { timeout: 60_000 }).toBe("lobby");
  await expect.poll(async () => { if ((await scene(page)) !== "archaeology") await tap(page, BASE_WIDTH / 10, BASE_HEIGHT - 90); return scene(page); }, { timeout: 30_000 }).toBe("archaeology");
  await page.waitForTimeout(600);

  // ── 특성 연구 ── 둘째 라벨.
  await tap(page, 60 + 140 + 296, BASE_HEIGHT - 268);
  await page.waitForTimeout(700);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-research-tab.png`);
  const slot = researchSlotCenter(BASE_WIDTH, false);
  await expect.poll(async () => { if ((await popupCount(page)) === 0) await tap(page, slot.x + RESEARCH_SHIFT_X, slot.y); return popupCount(page); }, { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(700);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-research-empty.png`);
  const first = cardSpot(6, 1);
  await tap(page, first.x, first.y);
  await page.waitForTimeout(400);
  // 누르기만 해서는 판이 닫히지 않는다.
  expect(await popupCount(page)).toBe(1);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-research-picked.png`);
  const pick = selectSpot(6, 1);
  await tap(page, pick.x, pick.y);
  await expect.poll(() => popupCount(page)).toBe(0);
  await page.waitForTimeout(1200);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-research-slotted.png`);

  // ── 합성 ── 셋째 라벨. 첫 칸을 누르고 같은 등급 셋을 차례로 넣는다.
  await tap(page, 60 + 140 + 2 * 296, BASE_HEIGHT - 268);
  await page.waitForTimeout(700);
  const vertex = runeSynthesisVertices(BASE_WIDTH)[0];
  await expect.poll(async () => { if ((await popupCount(page)) === 0) await tap(page, vertex.x, vertex.y); return popupCount(page); }, { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(700);
  await tap(page, cardSpot(6, 2).x, cardSpot(6, 2).y);
  await page.waitForTimeout(400);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-synth-picked.png`);
  await tap(page, selectSpot(6, 3).x, selectSpot(6, 3).y);
  await page.waitForTimeout(500);
  // 다음 빈 칸으로 이어진다 — 판은 그대로다.
  expect(await popupCount(page)).toBe(1);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-synth-next.png`);
  await tap(page, cardSpot(6, 0).x, cardSpot(6, 0).y);
  await page.waitForTimeout(300);
  await tap(page, selectSpot(6, 3).x, selectSpot(6, 3).y);
  await page.waitForTimeout(400);
  await tap(page, cardSpot(6, 0).x, cardSpot(6, 0).y);
  await page.waitForTimeout(300);
  await tap(page, selectSpot(6, 3).x, selectSpot(6, 3).y);
  // 마지막 칸까지 차면 닫힌다.
  await expect.poll(() => popupCount(page)).toBe(0);
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-select-synth-full.png`);
});
