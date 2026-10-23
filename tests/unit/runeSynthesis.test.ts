import { describe, expect, it } from "vitest";
import type { RuneRarity } from "../../src/core/runes";
import { RANDOM_RUNE_RARITY_PERCENT, RUNE_SYNTHESIS_RULES, rollRandomRuneRarity, rollRuneSynthesisRarity, rollRuneSynthesisTraitGrade, runeSynthesisRarityOdds, runeSynthesisTraitOdds } from "../../src/core/runeSynthesis";
import type { RuneTrait, RuneTraitGrade } from "../../src/core/runeTraits";

const RARITIES: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];
const trait = (grade: RuneTraitGrade): RuneTrait => ({ id: "x", grade, upgradeMisses: 0 });
const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

describe("룬 합성 규칙", () => {
  it("골드는 등급마다 오르고, 결과 등급은 같거나 한 단계 위일 뿐 내려가지 않는다", () => {
    expect(RUNE_SYNTHESIS_RULES.goldCost).toEqual({ uncommon: 200_000, rare: 400_000, epic: 600_000, legendary: 1_000_000 });
    for (const rarity of RARITIES) {
      const odds = runeSynthesisRarityOdds(rarity);
      expect(odds.same + odds.up).toBe(100);
      for (const random of [0, 0.2, 0.5, 0.99]) {
        const result = rollRuneSynthesisRarity(rarity, random);
        expect([rarity, odds.next]).toContain(result);
      }
    }
    expect(rollRuneSynthesisRarity("legendary", 0)).toBe("legendary");
    expect(rollRuneSynthesisRarity("uncommon", 0)).toBe("rare");
    expect(rollRuneSynthesisRarity("uncommon", 0.99)).toBe("uncommon");
  });

  it("특성 확률표의 모든 줄은 100%이고, 최고 등급이 높을수록 특성 없음이 줄어든다", () => {
    const rows = RUNE_SYNTHESIS_RULES.traitPercent;
    for (const row of Object.values(rows)) expect(sum(row)).toBe(100);
    expect(rows.none[0]).toBeGreaterThan(rows.uncommon[0]);
    expect(rows.uncommon[0]).toBeGreaterThan(rows.rare[0]);
    expect(rows.rare[0]).toBeGreaterThan(rows.epic[0]);
    expect(rows.epic[0]).toBeGreaterThan(rows.legendary[0]);
  });

  it("특성 달린 룬이 하나 더 있을 때마다 「없음」에서 최고 등급 칸으로 옮긴다", () => {
    expect(runeSynthesisTraitOdds([undefined, undefined, undefined])).toEqual([85, 12, 3, 0, 0]);
    expect(runeSynthesisTraitOdds([trait("rare"), undefined, undefined])).toEqual([30, 30, 30, 9, 1]);
    expect(runeSynthesisTraitOdds([trait("rare"), trait("uncommon"), undefined])).toEqual([20, 30, 40, 9, 1]);
    expect(runeSynthesisTraitOdds([trait("legendary"), trait("epic"), trait("rare")])).toEqual([0, 15, 20, 30, 35]);
    for (const odds of [runeSynthesisTraitOdds([trait("epic"), trait("epic"), trait("epic")])]) expect(sum(odds)).toBe(100);
  });

  it("특성 굴림은 확률표의 칸을 그대로 따른다", () => {
    expect(rollRuneSynthesisTraitGrade([undefined, undefined, undefined], 0)).toBeUndefined();
    expect(rollRuneSynthesisTraitGrade([undefined, undefined, undefined], 0.9)).toBe("uncommon");
    expect(rollRuneSynthesisTraitGrade([trait("legendary"), undefined, undefined], 0.999)).toBe("legendary");
  });

  it("랜덤 룬의 등급 확률은 100%이고 굴림이 모든 등급에 닿는다", () => {
    expect(sum(Object.values(RANDOM_RUNE_RARITY_PERCENT))).toBe(100);
    expect(rollRandomRuneRarity(0)).toBe("uncommon");
    expect(rollRandomRuneRarity(0.6)).toBe("rare");
    expect(rollRandomRuneRarity(0.9)).toBe("epic");
    expect(rollRandomRuneRarity(0.999)).toBe("legendary");
  });
});
