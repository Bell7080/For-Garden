import { describe, expect, it } from "vitest";
import { generateRune } from "../../src/core/runes";
import { isRuneBulkCraftCandidate, isRuneBulkModeCandidate, runeBulkCraftTotals, runeBulkCraftWork } from "../../src/core/runeBulkCraft";
import { enhanceRune, runeBatchEnhancementTargets, runeEnhancementIncrease } from "../../src/core/runes";
import { runeBulkCraftLayout, RUNE_BULK_CRAFT } from "../../src/ui/runeBulkCraftLayout";
import { BASE_HEIGHT } from "../../src/config/gameConfig";

const rune = (id: string) => {
  let seed = 0.37;
  const random = () => { seed = (seed * 9301 + 0.49297) % 1; return seed; };
  return generateRune({ instanceId: id, baseName: "rune", rarity: "epic", part: 0, random });
};

describe("룬 일괄 세공 규칙", () => {
  it("세공이 남은 룬은 언제나 후보이고, 다 마친 룬은 각인을 고른 때만 선다", () => {
    const fresh = rune("a");
    expect(runeBulkCraftWork(fresh, null)).toEqual({ enhancements: expect.any(Number), engrave: false });
    expect(runeBulkCraftWork(fresh, null).enhancements).toBeGreaterThan(0);
    const done = { ...fresh, enhancementComplete: true, enhancementHistory: Object.fromEntries(fresh.mainStats.map(({ key }) => [key, [true, true, true]])) };
    expect(runeBulkCraftWork(done, null).enhancements).toBe(0);
    expect(isRuneBulkCraftCandidate(done, null)).toBe(false);
    expect(isRuneBulkCraftCandidate(done, 0)).toBe(true);
    const engraved = { ...done, engravings: [{ statKey: done.mainStats[0].key, valueAdded: 1 }] };
    expect(runeBulkCraftWork(engraved, 1).engrave).toBe(false);
  });

  it("세공 판과 각인 판은 서로 다른 룬을 받는다 — 각인 판에는 세공을 마친 각인 전 룬만 선다", () => {
    const fresh = rune("a");
    let done = fresh;
    for (const key of runeBatchEnhancementTargets(fresh)) done = enhanceRune(done, key, runeEnhancementIncrease(done.rarity, key), 0.3);
    expect(isRuneBulkModeCandidate(fresh, "craft")).toBe(true);
    expect(isRuneBulkModeCandidate(fresh, "engrave")).toBe(false);
    expect(isRuneBulkModeCandidate(done, "craft")).toBe(false);
    expect(isRuneBulkModeCandidate(done, "engrave")).toBe(true);
    // 각인 판이 서버에 보내는 룬은 세공이 남지 않아 각인만 된다(세공 0회).
    expect(runeBulkCraftWork(done, 0)).toEqual({ enhancements: 0, engrave: true });
    const engraved = { ...done, engravings: [{ statKey: done.mainStats[0].key, valueAdded: 1 }] };
    expect(isRuneBulkModeCandidate(engraved, "engrave")).toBe(false);
  });

  it("합계는 할 일이 있는 룬만 센다", () => {
    const a = rune("a"); const b = rune("b");
    const totals = runeBulkCraftTotals([a, b], 0);
    expect(totals.runes).toBe(2); expect(totals.engravings).toBe(2);
    expect(totals.enhancements).toBe(runeBulkCraftWork(a, 0).enhancements + runeBulkCraftWork(b, 0).enhancements);
  });
});

describe("룬 일괄 세공 판 자리", () => {
  it("판이 화면 안에 들고 조작 줄이 위에서 아래로 쌓이며 판 안에 든다", () => {
    for (const total of [0, 3, 40]) {
      const layout = runeBulkCraftLayout(total);
      expect(layout.height).toBeLessThan(BASE_HEIGHT - 200);
      const half = layout.height / 2;
      expect(layout.selectY).toBeLessThan(layout.modeY);
      expect(layout.modeY).toBeLessThan(layout.buttonY);
      expect(layout.buttonY + RUNE_BULK_CRAFT.buttonHeight / 2).toBeLessThanOrEqual(half);
      // 전환 버튼 둘과 각인 버튼 둘은 판 안쪽 좌우 끝을 넘지 않고 서로 겹치지 않는다.
      expect(layout.modeXs[0] - layout.modeWidth / 2).toBeGreaterThanOrEqual(layout.left - 0.5);
      expect(layout.modeXs[1] + layout.modeWidth / 2).toBeLessThanOrEqual(layout.right + 0.5);
      expect(layout.modeXs[0] + layout.modeWidth / 2).toBeLessThan(layout.modeXs[1] - layout.modeWidth / 2);
      expect(layout.engraveXs[0] + layout.engraveWidth / 2).toBeLessThan(layout.engraveXs[1] - layout.engraveWidth / 2);
      expect(layout.engraveXs[1] + layout.engraveWidth / 2).toBeLessThanOrEqual(layout.right + 0.5);
    }
  });
});
