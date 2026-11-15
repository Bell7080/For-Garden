import { describe, expect, it } from "vitest";
import { encounterGroupPower, encounterUnitPowers, HORDE_POWER_SHARE } from "../../src/core/levelDesign";
import { withBaseStats } from "../../src/data/relics";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { cakeOperationEnemies, CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";

/**
 * 응태 2026-11-13: 「7-4쯤 4인 파티가 나보다 약한데 진다」 — 넷·다섯이 동시에 싸우는 스토리 무리를 평균 × 셋으로 줄여
 * 편성 화면이 지도보다 25~40% 낮게 적었다. 화면에 선 몸은 전부 더하고, 열다섯이 몰려오는 던전만 셋으로 맞춘다.
 */
describe("무리 표시 전투력", () => {
  it("스토리 넷·다섯 무리는 개체 전투력을 모두 더한다", () => {
    for (const id of ["7-4", "7-8"]) {
      const units = withBaseStats(getStageEnemies(getBattleStage(id)));
      expect(units.length).toBeGreaterThan(3);
      expect(encounterGroupPower(units)).toBe(encounterUnitPowers(units).reduce((sum, power) => sum + power, 0));
    }
  });
  it("물량 던전만 합에 몫(HORDE_POWER_SHARE)을 곱한다", () => {
    const units = withBaseStats(cakeOperationEnemies(CAKE_OPERATION_TIERS[0]));
    const total = encounterUnitPowers(units).reduce((sum, power) => sum + power, 0);
    expect(encounterGroupPower(units, { horde: true })).toBe(Math.round(total * HORDE_POWER_SHARE));
  });
});
