import { describe, expect, it } from "vitest";
import { combatPower, groupCombatPower } from "../../src/core/combatPower";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies } from "../../src/data/cakeOperation";

describe("groupCombatPower", () => {
  it("셋 이하로 서는 무리는 합 그대로다", () => {
    const [a, b] = cakeOperationEnemies(CAKE_OPERATION_TIERS[0]).map((def) => def.stats);
    expect(groupCombatPower([a])).toBe(combatPower(a));
    expect(groupCombatPower([a, b])).toBe(combatPower(a) + combatPower(b));
  });

  it("대작전 단계의 표시 전투력은 머릿수가 아니라 개체 세기를 따라 오른다", () => {
    const powers = CAKE_OPERATION_TIERS.map((tier) => groupCombatPower(cakeOperationEnemies(tier).map((def) => def.stats)));
    powers.forEach((power, i) => { if (i > 0) expect(power).toBeGreaterThan(powers[i - 1]); });
    // 열다섯의 합이 아니라 셋 몫이다: 한 개체 전투력의 3배 안팎.
    const one = combatPower(cakeOperationEnemies(CAKE_OPERATION_TIERS[7])[0].stats);
    expect(powers[7]).toBeLessThan(one * 3.2);
    expect(powers[7]).toBeGreaterThan(one * 2.8);
  });
});
