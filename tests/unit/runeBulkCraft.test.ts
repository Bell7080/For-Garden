import { describe, expect, it } from "vitest";
import { generateRune } from "../../src/core/runes";
import { isRuneBulkCraftCandidate, runeBulkCraftTotals, runeBulkCraftWork } from "../../src/core/runeBulkCraft";
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
      expect(layout.selectY).toBeLessThan(layout.engraveY);
      expect(layout.engraveY).toBeLessThan(layout.buttonY);
      expect(layout.buttonY + RUNE_BULK_CRAFT.buttonHeight / 2).toBeLessThanOrEqual(half);
      expect(layout.chipXs[0] - layout.chipWidth / 2).toBeGreaterThanOrEqual(layout.left + RUNE_BULK_CRAFT.engraveLabelWidth - 0.5);
      expect(layout.chipXs[2] + layout.chipWidth / 2).toBeLessThanOrEqual(layout.right + 0.5);
    }
  });
});
