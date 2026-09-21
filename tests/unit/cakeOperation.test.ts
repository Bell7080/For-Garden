import { describe, expect, it } from "vitest";
import { CAKE_OPERATION_ENEMY_IDS, CAKE_OPERATION_TIERS, cakeOperationRunCost, cakeOperationTierIndex, cakeOperationWaves, getCakeOperationTier, isCakeTierUnlocked } from "../../src/data/cakeOperation";
import { getRelic } from "../../src/data/relics";
import { ferocityBonusLevels } from "../../src/core/types";
import { applyLevelGrowth } from "../../src/core/relicProgression";

describe("치즈케이크 대작전 단계 표", () => {
  it("실효 레벨과 보상이 한 번도 내려가지 않는다", () => {
    const effective = CAKE_OPERATION_TIERS.map((tier) => tier.enemyLevel + ferocityBonusLevels(tier.ferocityLevel));
    for (let index = 1; index < CAKE_OPERATION_TIERS.length; index += 1) {
      expect(effective[index], CAKE_OPERATION_TIERS[index].id).toBeGreaterThan(effective[index - 1]);
      expect(CAKE_OPERATION_TIERS[index].rewardCheesecake).toBeGreaterThan(CAKE_OPERATION_TIERS[index - 1].rewardCheesecake);
    }
  });

  /** 아군을 키울 이유가 사다리에 있어야 한다 — 위로 갈수록 스테미나당 효율이 좋아진다. */
  it("스테미나당 효율이 위 단계로 갈수록 좋아진다", () => {
    const rate = CAKE_OPERATION_TIERS.map((tier) => tier.rewardCheesecake / tier.staminaCost);
    for (let index = 1; index < rate.length; index += 1) expect(rate[index]).toBeGreaterThan(rate[index - 1]);
  });

  /** 한 무리는 난전 상한인 다섯을 넘지 못한다 — 물량은 무리를 이어 붙여 만든다. */
  it("한 무리는 다섯을 넘지 않고 모든 단계가 여러 무리를 갖는다", () => {
    for (const tier of CAKE_OPERATION_TIERS) {
      expect(tier.waves.length, tier.id).toBeGreaterThan(1);
      for (const count of tier.waves) {
        expect(count, tier.id).toBeGreaterThan(0);
        expect(count, tier.id).toBeLessThanOrEqual(5);
      }
    }
  });

  it("첫 단계는 늘 열려 있고 그 뒤는 직전 단계를 이겨야 열린다", () => {
    expect(isCakeTierUnlocked("cake-1", -1)).toBe(true);
    expect(isCakeTierUnlocked("cake-2", -1)).toBe(false);
    expect(isCakeTierUnlocked("cake-2", 0)).toBe(true);
    expect(isCakeTierUnlocked("cake-3", 0)).toBe(false);
    expect(isCakeTierUnlocked("없는-단계", 99)).toBe(false);
    expect(cakeOperationTierIndex("cake-8")).toBe(CAKE_OPERATION_TIERS.length - 1);
    expect(() => getCakeOperationTier("없는-단계")).toThrow();
  });

  it("무리는 레벨과 야성 단계만으로 자라고 무리마다 사본을 세운다", () => {
    const tier = getCakeOperationTier("cake-6");
    const waves = cakeOperationWaves(tier);
    expect(waves.map((wave) => wave.length)).toEqual([...tier.waves]);
    const base = getRelic(CAKE_OPERATION_ENEMY_IDS[0]);
    const expected = applyLevelGrowth(base.stats, tier.enemyLevel + ferocityBonusLevels(tier.ferocityLevel), base.rarity);
    expect(waves[0][0].stats).toEqual(expected);
    // 같은 몸을 여러 전투원이 나눠 쓰면 한쪽의 피해가 다른 쪽에 묻는다.
    expect(waves[0][0].stats).not.toBe(waves[0][1].stats);
    expect(waves[0][0].stats).not.toBe(waves[1][0].stats);
  });

  it("다섯 자매를 차례로 세우고 다음 무리가 그 차례를 이어받는다", () => {
    /*
     * 한 종만 세우면 상성이 한 방향으로 고정되어 편성이 한 번 정해지면 다시 볼 이유가 없다.
     * 차례를 무리마다 되감지 않는 이유는, 셋짜리 무리만 이어지는 단계에서 늘 같은 세 자매만
     * 나오게 되기 때문이다.
     */
    const waves = cakeOperationWaves(getCakeOperationTier("cake-1"));
    const order = waves.flat().map(({ id }) => id);
    expect(order.slice(0, 5)).toEqual([...CAKE_OPERATION_ENEMY_IDS]);
    // 다섯이 한 바퀴를 돌면 처음으로 돌아온다.
    expect(order[5]).toBe(CAKE_OPERATION_ENEMY_IDS[0]);
    // 한 단계 안에서 다섯 속성이 모두 나온다 — 그것이 이 던전이 편성을 묻는 방법이다.
    expect(new Set(waves.flat().map(({ element }) => element)).size).toBe(5);
  });

  it("한 판의 값은 배율을 먹이기 전의 값이다", () => {
    const tier = getCakeOperationTier("cake-3");
    expect(cakeOperationRunCost(tier)).toEqual({ staminaCost: tier.staminaCost, rewards: { cheesecake: tier.rewardCheesecake } });
  });
});
