import { describe, expect, it } from "vitest";
import {
  applyRuneFerocityGain,
  applyRuneLifeSteal,
  assertValidRuneInstance,
  createRuneInstance,
  RUNE_RARITY_LABELS,
  RUNE_SUB_STAT_COUNTS,
  runeCombatModifiers,
  type RuneRarity,
  type RuneStatKey,
} from "../../src/core/runes";

/** 모든 생성 가능 키에 같은 값을 넣어 이 테스트가 선택 결과가 아니라 불변 규칙만 검증하게 한다. */
const STAT_VALUES: Record<RuneStatKey, number> = {
  hp: 10, atk: 10, ap: 10, def: 10, res: 10,
  moveSpeed: 5, attackSpeed: 5, lifeSteal: 5, critChance: 5, critDamage: 5, ferocityGain: 5, energyGain: 5,
};

/** 고정 난수 열을 순환해 생성 결과를 재현한다. */
function sequenceRandom(): () => number {
  const values = [0, 0.9, 0.2, 0.7, 0.4];
  let index = 0;
  return () => values[index++ % values.length];
}

/** 희귀도만 바꾸고 나머지 생성 계약은 공유하는 테스트 픽스처다. */
function makeRune(rarity: RuneRarity) {
  return createRuneInstance({ instanceId: `rune-${rarity}`, baseName: "테스트 룬", rarity, statValues: STAT_VALUES, random: sequenceRandom(), initialSuccessChance: 0.8 });
}

describe("룬 도메인", () => {
  it("한국어 희귀도 표기와 희귀도별 보조 옵션 수를 한 규칙으로 제공한다", () => {
    expect(RUNE_RARITY_LABELS).toEqual({ uncommon: "고급", rare: "희귀", epic: "영웅", legendary: "전설" });
    for (const rarity of Object.keys(RUNE_SUB_STAT_COUNTS) as RuneRarity[]) {
      const rune = makeRune(rarity);
      expect(rune.mainStats).toHaveLength(2);
      expect(rune.subStats).toHaveLength(RUNE_SUB_STAT_COUNTS[rarity]);
      expect(new Set([...rune.mainStats, ...rune.subStats].map(({ key }) => key)).size).toBe(2 + RUNE_SUB_STAT_COUNTS[rarity]);
    }
  });

  it("옵션 중복과 잘못된 강화 확률을 거부한다", () => {
    const rune = makeRune("rare");
    expect(() => assertValidRuneInstance({ ...rune, mainStats: [rune.mainStats[0], rune.mainStats[0]] })).toThrow(/중복/);
    expect(() => assertValidRuneInstance({ ...rune, currentSuccessChance: 1.1 })).toThrow(/0~1/);
  });

  it("Stats 밖의 흡혈과 야성 증가를 전투 계산 계약으로 적용한다", () => {
    const rune = makeRune("legendary");
    const customized = { ...rune, subStats: [
      { key: "lifeSteal" as const, value: 10 },
      { key: "ferocityGain" as const, value: 25 },
      { key: "energyGain" as const, value: 5 },
    ] };
    const modifiers = runeCombatModifiers(customized);
    expect(applyRuneLifeSteal(50, 100, 200, modifiers)).toBe(70);
    expect(applyRuneFerocityGain(12, modifiers)).toBe(15);
  });
});
