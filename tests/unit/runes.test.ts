import { describe, expect, it } from "vitest";
import {
  applyRuneFerocityGain,
  applyRuneLifeSteal,
  assertValidRuneInstance,
  calculateRuneEnhancementSuccessChance,
  canEngraveRune,
  canEnhanceRune,
  createRuneInstance,
  generateRune,
  engraveRune,
  enhanceRune,
  RUNE_ENHANCEMENT_RULES,
  RUNE_GENERATION_RULES,
  RUNE_RARITY_LABELS,
  RUNE_SUB_STAT_COUNTS,
  runeCombatModifiers,
  runeEnhancementIncrease,
  validateRuneInstance,
  type RuneInstance,
  type RuneRarity,
  type RuneStatKey,
} from "../../src/core/runes";
import { runeEnhancementGoldCost } from "../../src/data/runes";

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
  return createRuneInstance({ instanceId: `rune-${rarity}`, baseName: "테스트 룬", rarity, part: 0, statValues: STAT_VALUES, random: sequenceRandom() });
}

describe("룬 도메인", () => {
  it("같은 seed는 같은 옵션을 재현하고 수치는 등급 고정표만 따른다", () => {
    /** 간단한 선형 합동 생성기로 seed와 난수 열의 관계를 테스트 내에 고정한다. */
    const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
    const make = (random: () => number) => generateRune({ instanceId: "seeded", baseName: "재현 룬", rarity: "legendary", part: 1, random });
    const first = make(seeded(42)); const replay = make(seeded(42));
    expect(replay).toEqual(first);
    expect(first.mainStats).toHaveLength(2); expect(first.subStats).toHaveLength(3);
    expect(new Set([...first.mainStats, ...first.subStats].map(({ key }) => key)).size).toBe(5);
    expect(first.mainStats.every(({ value }) => value === RUNE_GENERATION_RULES.legendary.mainBase)).toBe(true);
    expect(first.subStats.every(({ value }) => value === RUNE_GENERATION_RULES.legendary.subBase)).toBe(true);
  });

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

  it("고정 난수의 성공과 실패에 따라 수치와 다음 확률만 알맞게 바꾼다", () => {
    const rune = makeRune("uncommon");
    const key = rune.mainStats[0].key;
    const originalValue = rune.mainStats[0].value;
    const success = enhanceRune(rune, key, 2, 0.74);
    expect(success.mainStats[0].value).toBe(originalValue + 2);
    expect(success.currentSuccessChance).toBeCloseTo(0.65);

    // 0.99는 조정된 확률보다 크므로 실패하며 옵션 수치는 그대로다.
    const failure = enhanceRune(success, key, 2, 0.99);
    expect(failure.mainStats[0].value).toBe(originalValue + 2);
    expect(failure.currentSuccessChance).toBeCloseTo(0.75);
    expect(failure.enhancementHistory[key]?.map(({ succeeded }) => succeeded)).toEqual([true, false]);
  });

  it("다음 성공률을 25~75% 범위로 제한한다", () => {
    expect(calculateRuneEnhancementSuccessChance(0.25, true)).toBe(RUNE_ENHANCEMENT_RULES.minimumSuccessChance);
    expect(calculateRuneEnhancementSuccessChance(0.75, false)).toBe(RUNE_ENHANCEMENT_RULES.maximumSuccessChance);
  });

  it("옵션별 세 번 제한과 존재하지 않는 옵션 강화를 거부한다", () => {
    let rune = makeRune("uncommon");
    const key = rune.mainStats[0].key;
    for (let attempt = 0; attempt < 3; attempt += 1) rune = enhanceRune(rune, key, 1, 0);
    expect(canEnhanceRune(rune, key)).toBe(false);
    expect(() => enhanceRune(rune, key, 1, 0)).toThrow(/세 번/);
    expect(() => enhanceRune(rune, "lifeSteal", 1, 0)).toThrow(/존재하지/);
  });

  it.each(Object.keys(RUNE_SUB_STAT_COUNTS) as RuneRarity[])("%s 등급은 모든 옵션을 세 번 시도한 뒤 완료된다", (rarity) => {
    let rune = makeRune(rarity);
    const keys = [...rune.mainStats, ...rune.subStats].map(({ key }) => key);
    for (const key of keys) {
      for (let attempt = 0; attempt < 3; attempt += 1) rune = enhanceRune(rune, key, 1, 0.99);
    }
    expect(rune.enhancementComplete).toBe(true);
    expect(Object.values(rune.enhancementHistory).flat()).toHaveLength(RUNE_ENHANCEMENT_RULES.totalAttempts[rarity]);
    expect(() => runeEnhancementGoldCost(rarity, RUNE_ENHANCEMENT_RULES.totalAttempts[rarity])).toThrow(/다음 비용/);
  });

  it("완료 전 각인을 막고 완료 후 확정 각인을 한 번만 허용한다", () => {
    let rune = makeRune("uncommon");
    const result = { statKey: rune.mainStats[0].key, grade: "perfect" as const, valueAdded: 5 };
    expect(canEngraveRune(rune)).toBe(false);
    expect(() => engraveRune(rune, result)).toThrow(/모든 강화/);
    for (const { key } of rune.mainStats) {
      for (let attempt = 0; attempt < 3; attempt += 1) rune = enhanceRune(rune, key, 1, 0);
    }
    const engraved = engraveRune(rune, result);
    expect(engraved.engravings).toEqual([result]);
    expect(() => engraveRune(engraved, result)).toThrow(/각인 전/);
  });
});

describe("룬 파츠", () => {
  it("는 0~2만 허용하고 그 밖의 값은 저장 불변식에서 거부한다", () => {
    const rune = makeRune("uncommon");
    expect(rune.part).toBe(0);
    expect(validateRuneInstance({ ...rune, part: 2 })).toBe(true);
    expect(validateRuneInstance({ ...rune, part: 3 as RuneInstance["part"] })).toBe(false);
  });
});

describe("각인 규칙", () => {
  /** 세 번씩 다 채운 뒤 각인만 남은 룬을 만든다. */
  function completedRune(): RuneInstance {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 8])) as Record<RuneStatKey, number>;
    let rune = createRuneInstance({ instanceId: "engrave-1", baseName: "각인 테스트", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
    for (const { key } of rune.mainStats) for (let count = 0; count < 3; count += 1) rune = enhanceRune(rune, key, runeEnhancementIncrease(rune.rarity, key), 0);
    return rune;
  }

  it("은 기록만 남기지 않고 그 옵션의 수치도 함께 올린다", () => {
    const rune = completedRune();
    const target = rune.mainStats[0];
    const engraved = engraveRune(rune, { statKey: target.key, valueAdded: 2 });
    // 화면에 보이는 값과 전투 계산(각인을 성공 한 번으로 세는 applyHeartGems)이 갈리지 않는다.
    expect(engraved.mainStats[0].value).toBe(target.value + 2);
    expect(engraved.mainStats[1].value).toBe(rune.mainStats[1].value);
    expect(engraved.engravings).toEqual([{ statKey: target.key, valueAdded: 2 }]);
  });

  it("은 등급 없이도 유효하고 예전 저장의 등급도 그대로 읽는다", () => {
    const rune = completedRune();
    expect(validateRuneInstance(engraveRune(rune, { statKey: rune.mainStats[0].key, valueAdded: 2 }))).toBe(true);
    expect(validateRuneInstance(engraveRune(rune, { statKey: rune.mainStats[0].key, grade: "perfect", valueAdded: 3 }))).toBe(true);
  });
});
