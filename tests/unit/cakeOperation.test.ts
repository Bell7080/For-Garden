import { describe, expect, it } from "vitest";
import { DUNGEON_RUN_STAMINA } from "../../src/core/dungeonShortcut";
import { CAKE_OPERATION_ENEMY_IDS, CAKE_OPERATION_TIERS, cakeOperationRunCost, cakeOperationTierIndex, cakeOperationEnemies, getCakeOperationTier, isCakeTierUnlocked, cakeOperationEnemyDisplayLevel, cakeOperationRole } from "../../src/data/cakeOperation";
import { getRelic } from "../../src/data/relics";
import { applyEncounterScaling, encounterGroupPower } from "../../src/core/levelDesign";
import { applyLevelGrowth, referenceBreakthroughAt } from "../../src/core/relicProgression";
import { summarizeStageDifficulty } from "../../src/core/stageDifficulty";
import { battleArena } from "../../src/core/battleArena";
import { groupCombatPower } from "../../src/core/combatPower";
import { arrangeByRole } from "../../src/core/partyAffinity";
import { MAX_ENEMY_COUNT } from "../../src/core/skirmish";

describe("치즈케이크 대작전 단계 표", () => {
  it("실효 레벨과 보상이 한 번도 내려가지 않는다", () => {
    const effective = CAKE_OPERATION_TIERS.map((tier) => cakeOperationEnemyDisplayLevel(tier).level);
    for (let index = 1; index < CAKE_OPERATION_TIERS.length; index += 1) {
      expect(effective[index], CAKE_OPERATION_TIERS[index].id).toBeGreaterThan(effective[index - 1]);
      expect(CAKE_OPERATION_TIERS[index].rewardCheesecake).toBeGreaterThan(CAKE_OPERATION_TIERS[index - 1].rewardCheesecake);
    }
  });

  /** 아군을 키울 이유가 사다리에 있어야 한다 — 위로 갈수록 스테미나당 효율이 좋아진다. */
  it("스테미나당 효율이 위 단계로 갈수록 좋아진다", () => {
    const rate = CAKE_OPERATION_TIERS.map((tier) => tier.rewardCheesecake / cakeOperationRunCost(tier).staminaCost);
    for (let index = 1; index < rate.length; index += 1) expect(rate[index]).toBeGreaterThan(rate[index - 1]);
  });

  /** 한 판의 적 전부가 한꺼번에 몰려온다 — 셋·넷씩 끊어 오는 웨이브가 아니라 물량전이다. */
  it("모든 단계가 열 마리 이상을 한꺼번에 세우고 난전 상한을 넘지 않는다", () => {
    for (const tier of CAKE_OPERATION_TIERS) {
      expect(tier.enemyCount, tier.id).toBeGreaterThanOrEqual(10);
      expect(tier.enemyCount, tier.id).toBeLessThanOrEqual(MAX_ENEMY_COUNT);
      expect(cakeOperationEnemies(tier), tier.id).toHaveLength(tier.enemyCount);
      expect(cakeOperationRole(tier), tier.id).toBe("swarm");
    }
    // 위로 갈수록 적도 줄지 않는다 — 머릿수가 줄어드는 단계는 사다리가 아니라 옆길이다.
    for (let index = 1; index < CAKE_OPERATION_TIERS.length; index += 1) {
      expect(CAKE_OPERATION_TIERS[index].enemyCount).toBeGreaterThanOrEqual(CAKE_OPERATION_TIERS[index - 1].enemyCount);
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

  it("무리는 레벨과 야성 단계만으로 자라고 개체마다 사본을 세운다", () => {
    const tier = getCakeOperationTier("cake-6");
    const enemies = cakeOperationEnemies(tier);
    const base = getRelic(CAKE_OPERATION_ENEMY_IDS[0]);
    const expected = applyEncounterScaling(base.stats, base.rarity, cakeOperationEnemyDisplayLevel(tier).level, cakeOperationRole(tier));
    expect(enemies[0].stats).toEqual(expected);
    // 같은 몸을 여러 전투원이 나눠 쓰면 한쪽의 피해가 다른 쪽에 묻는다.
    expect(enemies[0].stats).not.toBe(enemies[1].stats);
    expect(enemies[0].stats).not.toBe(enemies[5].stats);
  });

  it("다섯 자매를 차례로 되풀이해 세운다", () => {
    /*
     * 한 종만 세우면 상성이 한 방향으로 고정되어 편성이 한 번 정해지면 다시 볼 이유가 없다.
     */
    const enemies = cakeOperationEnemies(getCakeOperationTier("cake-1"));
    const order = enemies.map(({ id }) => id);
    expect(order.slice(0, 5)).toEqual([...CAKE_OPERATION_ENEMY_IDS]);
    // 다섯이 한 바퀴를 돌면 처음으로 돌아온다.
    expect(order[5]).toBe(CAKE_OPERATION_ENEMY_IDS[0]);
    // 한 단계 안에서 다섯 속성이 모두 나온다 — 그것이 이 던전이 편성을 묻는 방법이다.
    expect(new Set(enemies.map(({ element }) => element)).size).toBe(5);
  });

  it("한 판의 값은 레벨 사다리의 스테미나와 그 단계의 보상이다", () => {
    const tier = getCakeOperationTier("cake-3");
    expect(cakeOperationRunCost(tier)).toEqual({ staminaCost: DUNGEON_RUN_STAMINA, rewards: { cheesecake: tier.rewardCheesecake } });
  });
});

/**
 * **사다리와 표시 전투력 재측정**(응태 2026-11-15: 「난이도 곡선·전투력 표기 맞추자. 아군보다 낮은데 아군이 지는 일은 웬만해선 없어야」).
 *
 * 무작위 파티 10종(엘라·마키·스테라 · 토리카·도디·파루아 + 무작위 여덟)이 6판 중 5판을 이기는 최저 레벨의 중앙값이
 * 단계마다 1 · 10 · 17 · 24 · 30 · 38 · 46 · 53으로 고르게 오르게 레벨(9~57)과 머릿수(10~13)를 다시 놓았다.
 * 예전 사다리(LV.4~53 · 10~15마리)는 1~3단계를 레벨 1~6이 넘고 7~8단계는 표기보다 높아야 넘어 곡선이 앞에서 눕고 뒤에서 섰다.
 * 같은 측정에서 **지는 마지막 레벨의 아군 전투력은 적 합의 0.20~0.32배**였다 — 그 위(옛 `HORDE_POWER_SHARE` 0.35)에 표시를 두었다 — 2026-11-28 머릿수 보정(`headcountFactor`) 하나로 바꿨다.
 * 여기서는 그 약속을 빠르게 지킨다: 표시를 처음 넘는 레벨의 아군은 이긴다.
 */
describe("치즈케이크 대작전 표시 전투력", () => {
  const SEEDS = [1, 2, 3, 4, 5, 6];
  const PARTIES = [["ella", "maki", "stella"], ["torika", "dodi", "parua"]];
  const grow = (ids: string[], level: number) => arrangeByRole(ids.map((id) => {
    const def = getRelic(id);
    return { ...def, stats: applyLevelGrowth(def.stats, level, def.rarity, referenceBreakthroughAt(level)) };
  }));
  const power = (party: ReturnType<typeof grow>) => groupCombatPower(party);

  it.each([0, 3, 7])("%i번째 단계에서 표시를 넘긴 아군은 이긴다", (index) => {
    const tier = CAKE_OPERATION_TIERS[index];
    const enemies = cakeOperationEnemies(tier);
    const shown = encounterGroupPower(enemies);
    for (const ids of PARTIES) {
      let level = 1;
      while (level < 100 && power(grow(ids, level)) < shown) level += 1;
      const result = summarizeStageDifficulty(grow(ids, level), enemies, SEEDS, "auto", battleArena("cake"));
      expect(result.winRate, `${tier.id} ${ids.join("·")} LV.${level}`).toBeGreaterThanOrEqual(5 / 6);
    }
  }, 120_000);
});
