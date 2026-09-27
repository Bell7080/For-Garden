import { describe, expect, it } from "vitest";
import {
  DUNGEON_RUN_STAMINA, SWEEP_COUNT_LIMIT, maxSweepCount, normalizeSweepCount, settleSweep, sweepRefusal,
} from "../../src/core/dungeonShortcut";
import { bountyRunCost } from "../../src/core/bountyRun";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS, cakeOperationRunCost } from "../../src/data/cakeOperation";

const COST = { staminaCost: 10, rewards: { cheesecake: 46 } };

describe("던전 단축 규칙", () => {
  it("소탕 횟수는 스테미나와 보상에 같은 수를 곱한다", () => {
    for (const count of [1, 2, 7, SWEEP_COUNT_LIMIT]) {
      const settled = settleSweep(COST, count, false);
      expect(settled.staminaCost).toBe(COST.staminaCost * count);
      expect(settled.rewards.cheesecake).toBe(COST.rewards.cheesecake * count);
      // 효율이 횟수로 갈리면 몇 번에 나눠 소탕하는지가 숨은 선택이 된다.
      expect(settled.rewards.cheesecake / settled.staminaCost).toBeCloseTo(COST.rewards.cheesecake / COST.staminaCost, 10);
    }
  });

  it("멤버십이 없으면 한 번에 소탕권 한 장이 들고, 멤버십이면 들지 않는다", () => {
    expect(settleSweep(COST, 4, false).ticketCost).toBe(4);
    expect(settleSweep(COST, 4, true).ticketCost).toBe(0);
  });

  it("횟수는 1 이상 상한 이하의 정수만 받는다", () => {
    expect(normalizeSweepCount(3)).toBe(3);
    for (const bogus of [0, -1, SWEEP_COUNT_LIMIT + 1, 2.5, "3", null, undefined, {}]) expect(normalizeSweepCount(bogus)).toBeUndefined();
  });

  it("MAX는 스테미나와 소탕권 중 먼저 떨어지는 쪽이 정한다", () => {
    expect(maxSweepCount({ stamina: 95, tickets: 20, adFreeMembership: false, cost: COST })).toBe(9);
    expect(maxSweepCount({ stamina: 95, tickets: 3, adFreeMembership: false, cost: COST })).toBe(3);
    // 멤버십은 소탕권을 보지 않는다.
    expect(maxSweepCount({ stamina: 95, tickets: 0, adFreeMembership: true, cost: COST })).toBe(9);
    expect(maxSweepCount({ stamina: 5, tickets: 3, adFreeMembership: false, cost: COST })).toBe(0);
    expect(maxSweepCount({ stamina: 99_999, tickets: 999, adFreeMembership: false, cost: COST })).toBe(SWEEP_COUNT_LIMIT);
  });

  it("소탕은 이겨 본 단계·올바른 횟수·충분한 소탕권과 스테미나를 모두 요구한다", () => {
    const base = { cleared: true, count: 2, adFreeMembership: false, tickets: 5, stamina: 100, cost: COST };
    expect(sweepRefusal(base)).toBeNull();
    expect(sweepRefusal({ ...base, cleared: false })).toBe("not_cleared");
    expect(sweepRefusal({ ...base, count: 0 })).toBe("invalid_count");
    expect(sweepRefusal({ ...base, tickets: 1 })).toBe("not_enough_tickets");
    expect(sweepRefusal({ ...base, tickets: 0, adFreeMembership: true })).toBeNull();
    // 두 번은 20이 드는데 19만 있으면 막힌다 — 한 판 값(10)으로 재지 않는다.
    expect(sweepRefusal({ ...base, stamina: 19 })).toBe("not_enough_stamina");
  });
});

/** 두 던전의 모든 단계가 같은 값을 치른다 — 단계가 가르는 것은 보상뿐이다. */
describe("던전 한 판의 스테미나", () => {
  it("대작전 여덟 단계와 현상수배 다섯 등급이 모두 10이다", () => {
    expect(DUNGEON_RUN_STAMINA).toBe(10);
    expect(CAKE_OPERATION_TIERS.map((tier) => cakeOperationRunCost(tier).staminaCost)).toEqual(CAKE_OPERATION_TIERS.map(() => 10));
    expect(BOUNTY_TIERS.map((tier) => bountyRunCost(tier).staminaCost)).toEqual(BOUNTY_TIERS.map(() => 10));
  });
});
