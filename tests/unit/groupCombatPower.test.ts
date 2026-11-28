import { describe, expect, it } from "vitest";
import { combatPower, groupCombatPower, headcountFactor, statTotal } from "../../src/core/combatPower";
import { encounterGroupPower, encounterUnitPowers } from "../../src/core/levelDesign";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies } from "../../src/data/cakeOperation";
import { getRelic } from "../../src/data/relics";

/**
 * 응태 결정 2026-11-28 — 전투력은 체감 세기(버티는 몫 × 때리는 몫)이고, 적과 아군이 같은 규칙을 쓴다.
 * 자리마다 얹던 표시 몫(정예 ×1.6·×2.0 · 물량 ×0.35 · 1대1 ×1.8)은 없고 무리는 합 × 머릿수 몫 하나다.
 */
describe("체감 전투력", () => {
  it("은 버티는 몫과 때리는 몫을 곱해 잰다 — 한쪽이 0이면 0이다", () => {
    const base = getRelic("torika").stats;
    expect(combatPower({ ...base, atk: 0, ap: 0 }, "tank")).toBe(0);
    expect(combatPower({ ...base, hp: base.hp * 2 }, "tank")).toBeGreaterThan(combatPower(base, "tank"));
    expect(combatPower({ ...base, def: base.def + 100 }, "tank")).toBeGreaterThan(combatPower(base, "tank"));
    expect(combatPower({ ...base, attackSpeed: base.attackSpeed * 2 }, "tank")).toBeGreaterThan(combatPower(base, "tank"));
  });

  it("지원가는 때리는 몫을 절반만 센다", () => {
    const stats = getRelic("terisa").stats;
    expect(combatPower(stats, "support")).toBeLessThan(combatPower(stats, "warrior"));
  });

  it("무리는 개체 합 × (셋 ÷ 머릿수)^0.35 — 셋이면 합 그대로다", () => {
    expect(headcountFactor(3)).toBe(1);
    expect(headcountFactor(1)).toBeCloseTo(3 ** 0.35, 6);
    const stage = getStageEnemies(getBattleStage("1-6"));
    expect(stage.length).toBe(3);
    expect(encounterGroupPower(stage)).toBe(encounterUnitPowers(stage).reduce((sum, power) => sum + power, 0));
    for (const id of ["7-4", "7-8", "1-5"]) {
      const units = getStageEnemies(getBattleStage(id));
      const sum = encounterUnitPowers(units).reduce((total, power) => total + power, 0);
      expect(encounterGroupPower(units)).toBe(Math.round(sum * headcountFactor(units.length)));
    }
  });

  it("물량 던전도 같은 규칙이고, 단계가 오를수록 표시가 오른다", () => {
    const powers = CAKE_OPERATION_TIERS.map((tier) => groupCombatPower(cakeOperationEnemies(tier)));
    powers.forEach((power, i) => { if (i > 0) expect(power).toBeGreaterThan(powers[i - 1]); });
    const units = cakeOperationEnemies(CAKE_OPERATION_TIERS[0]);
    expect(encounterGroupPower(units)).toBe(groupCombatPower(units));
  });

  it("등급 띠는 전투력이 아니라 종족값 총량으로 잰다", () => {
    const relic = getRelic("maddy");
    expect(statTotal(relic.stats)).not.toBe(combatPower(relic.stats, relic.role));
  });
});
