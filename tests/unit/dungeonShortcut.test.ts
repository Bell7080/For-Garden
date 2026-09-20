import { describe, expect, it } from "vitest";
import { DUNGEON_MULTIPLIERS, FREE_MULTIPLIER_LIMIT, applyDungeonMultiplier, isMultiplierUnlocked, normalizeMultiplier, sweepRefusal } from "../../src/core/dungeonShortcut";

const COST = { staminaCost: 10, rewards: { cheesecake: 46 } };

describe("던전 단축 규칙", () => {
  it("배율은 스테미나와 보상에 같은 수를 곱한다", () => {
    for (const multiplier of DUNGEON_MULTIPLIERS) {
      const settled = applyDungeonMultiplier(COST, multiplier);
      expect(settled.staminaCost).toBe(COST.staminaCost * multiplier);
      expect(settled.rewards.cheesecake).toBe(COST.rewards.cheesecake * multiplier);
      // 효율이 배율로 갈리면 어느 배율로 도는지가 숨은 선택이 된다.
      expect(settled.rewards.cheesecake / settled.staminaCost).toBeCloseTo(COST.rewards.cheesecake / COST.staminaCost, 10);
    }
  });

  it("무료 구간까지는 누구나 쓰고 그 위는 멤버십만 연다", () => {
    for (const multiplier of DUNGEON_MULTIPLIERS) {
      expect(isMultiplierUnlocked(multiplier, false)).toBe(multiplier <= FREE_MULTIPLIER_LIMIT);
      expect(isMultiplierUnlocked(multiplier, true)).toBe(true);
    }
  });

  /** 저장이나 씬 데이터로 흘러들어온 아무 값도 실제로 있는 배율로만 좁힌다. */
  it("표에 없는 값은 x1로 수렴한다", () => {
    expect(normalizeMultiplier(2)).toBe(2);
    for (const bogus of [0, -1, 4, 2.5, "3", null, undefined, {}]) expect(normalizeMultiplier(bogus)).toBe(1);
  });

  it("소탕은 이겨 본 단계·열린 배율·충분한 스테미나를 모두 요구한다", () => {
    const base = { cleared: true, multiplier: 2 as const, adFreeMembership: false, stamina: 100, cost: COST };
    expect(sweepRefusal(base)).toBeNull();
    expect(sweepRefusal({ ...base, cleared: false })).toBe("not_cleared");
    expect(sweepRefusal({ ...base, multiplier: 3 })).toBe("multiplier_locked");
    expect(sweepRefusal({ ...base, multiplier: 3, adFreeMembership: true })).toBeNull();
    // x2는 20이 드는데 19만 있으면 막힌다 — 한 판 값(10)으로 재지 않는다.
    expect(sweepRefusal({ ...base, stamina: 19 })).toBe("not_enough_stamina");
  });
});
