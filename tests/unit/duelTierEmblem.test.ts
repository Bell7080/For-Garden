import { describe, expect, it } from "vitest";
import { DUEL_TIER_EMBLEM_REACH, DUEL_TIER_ORDER, duelTierOrnaments } from "../../src/ui/duelTierEmblemShape";

describe("티어 표식 장식(임시)", () => {
  it("티어가 오를수록 장식이 줄지 않고, 이웃 티어끼리 실루엣이 갈린다", () => {
    const sets = DUEL_TIER_ORDER.map((tier) => duelTierOrnaments(tier));
    expect(sets[0]).toHaveLength(0);
    for (let i = 1; i < sets.length; i += 1) {
      expect(sets[i].length).toBeGreaterThanOrEqual(sets[i - 1].length);
      expect(JSON.stringify(sets[i])).not.toBe(JSON.stringify(sets[i - 1]));
    }
  });

  it("모든 장식은 표식 가운데에서 정한 거리 안에 든다 — 목록 줄의 옆 글자를 덮지 않는다", () => {
    for (const tier of DUEL_TIER_ORDER) {
      for (const ornament of duelTierOrnaments(tier)) {
        expect(ornament.points.length % 2).toBe(0);
        for (const value of ornament.points) expect(Math.abs(value)).toBeLessThanOrEqual(DUEL_TIER_EMBLEM_REACH);
      }
    }
  });
});
