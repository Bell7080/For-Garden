import { describe, expect, it } from "vitest";
import {
  DUNGEON_STAMINA_LADDER, SWEEP_COUNT_LIMIT, dungeonRunStamina, maxSweepCount, normalizeSweepCount, settleSweep, sweepRefusal,
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

/** 같은 레벨은 어느 던전에서나 같은 값을 치른다 — 현상수배가 15로 고정이던 때 같은 `LV.15`가 10과 15로 갈렸다. */
describe("던전 스테미나 사다리", () => {
  it("사다리는 레벨이 오를수록 내려가지 않는다", () => {
    for (let index = 1; index < DUNGEON_STAMINA_LADDER.length; index += 1) {
      expect(DUNGEON_STAMINA_LADDER[index][0]).toBeGreaterThan(DUNGEON_STAMINA_LADDER[index - 1][0]);
      expect(DUNGEON_STAMINA_LADDER[index][1]).toBeGreaterThanOrEqual(DUNGEON_STAMINA_LADDER[index - 1][1]);
    }
  });

  it("대작전 여덟 단계와 현상수배 다섯 등급이 모두 제 레벨로 사다리를 읽는다", () => {
    expect(CAKE_OPERATION_TIERS.map((tier) => cakeOperationRunCost(tier).staminaCost)).toEqual([6, 8, 10, 12, 14, 16, 18, 20]);
    expect(BOUNTY_TIERS.map((tier) => bountyRunCost(tier).staminaCost)).toEqual(BOUNTY_TIERS.map((tier) => dungeonRunStamina(tier.rounds[0].level)));
    // 같은 레벨(5·15)의 두 던전 단계는 같은 값이다.
    expect(bountyRunCost(BOUNTY_TIERS[0]).staminaCost).toBe(cakeOperationRunCost(CAKE_OPERATION_TIERS[0]).staminaCost);
    expect(bountyRunCost(BOUNTY_TIERS[1]).staminaCost).toBe(cakeOperationRunCost(CAKE_OPERATION_TIERS[2]).staminaCost);
  });

  /** 하루 세 번 제한을 걷어 내며 스테미나가 바뀌었어도 1당 골드는 예전(15 고정) 그대로다. */
  it("현상수배의 스테미나 1당 골드는 예전 효율에서 벗어나지 않는다", () => {
    const before = [3_000, 5_000, 8_000, 12_000, 18_000].map((gold) => gold / 15);
    BOUNTY_TIERS.forEach((tier, index) => {
      const cost = bountyRunCost(tier);
      expect(Math.abs(tier.rewardGold / cost.staminaCost - before[index]!) / before[index]!).toBeLessThan(0.02);
    });
  });
});
