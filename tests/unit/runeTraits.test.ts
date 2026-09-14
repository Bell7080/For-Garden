import { describe, expect, it } from "vitest";
import {
  canUpgradeRuneTraitGrade, grantRuneTrait, nextRuneTraitGrade, rerollRuneTrait,
  RUNE_TRAIT_GRADES, RUNE_TRAIT_RULES, upgradeRuneTraitGrade, type RuneTrait,
} from "../../src/core/runeTraits";
import { RUNE_TRAIT_DEFS, RUNE_TRAIT_IDS, runeTraitValue } from "../../src/data/runeTraits";
import { runeTraitCombatEffects } from "../../src/core/runeTraitEffects";

/** 정해진 순서대로 돌려주는 난수. 마지막 값에서 멈춘다. */
function scripted(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe("룬 특성", () => {
  it("은 부여한 최소 등급 아래로 내려가지 않는다", () => {
    for (const minimumGrade of RUNE_TRAIT_GRADES) {
      const trait = grantRuneTrait({ traitIds: RUNE_TRAIT_IDS, minimumGrade, random: scripted([0.999, 0.5]) });
      expect(RUNE_TRAIT_GRADES.indexOf(trait.grade)).toBeGreaterThanOrEqual(RUNE_TRAIT_GRADES.indexOf(minimumGrade));
      expect(RUNE_TRAIT_IDS).toContain(trait.id);
    }
  });

  it("의 재해석은 등급을 내리지 않는다", () => {
    const trait: RuneTrait = { id: "vanguard", grade: "epic", upgradeMisses: 0 };
    // 상승 판정과 종류 추첨 모두 가장 불리한 난수를 준다.
    const outcome = rerollRuneTrait({ trait, traitIds: RUNE_TRAIT_IDS, random: scripted([0.999, 0.5]) });
    expect(outcome.upgraded).toBe(false);
    expect(outcome.candidate.grade).toBe("epic");
  });

  it("의 천장은 연속 실패가 임계에 닿는 재해석에서 확정으로 올린다", () => {
    const threshold = RUNE_TRAIT_RULES.pityThreshold.uncommon;
    const trait: RuneTrait = { id: "vanguard", grade: "uncommon", upgradeMisses: threshold - 1 };
    const outcome = rerollRuneTrait({ trait, traitIds: RUNE_TRAIT_IDS, random: scripted([0.999, 0.5]) });
    expect(outcome.byPity).toBe(true);
    expect(outcome.upgraded).toBe(true);
    expect(outcome.candidate.grade).toBe("rare");
    // 등급이 오르면 천장은 새 등급에서 다시 돈다.
    expect(outcome.candidate.upgradeMisses).toBe(0);
  });

  it("의 실패는 쌓이고 성공은 초기화한다", () => {
    const trait: RuneTrait = { id: "vanguard", grade: "rare", upgradeMisses: 3 };
    const missed = rerollRuneTrait({ trait, traitIds: RUNE_TRAIT_IDS, random: scripted([0.999, 0.5]) });
    expect(missed.candidate.upgradeMisses).toBe(4);
    const hit = rerollRuneTrait({ trait, traitIds: RUNE_TRAIT_IDS, random: scripted([0, 0.5]) });
    expect(hit.upgraded).toBe(true);
    expect(hit.candidate.upgradeMisses).toBe(0);
  });

  it("의 전설은 더 오르지 않는다", () => {
    const trait: RuneTrait = { id: "vanguard", grade: "legendary", upgradeMisses: 99 };
    expect(nextRuneTraitGrade("legendary")).toBeUndefined();
    expect(canUpgradeRuneTraitGrade(trait)).toBe(false);
    expect(rerollRuneTrait({ trait, traitIds: RUNE_TRAIT_IDS, random: scripted([0, 0.5]) }).upgraded).toBe(false);
    expect(() => upgradeRuneTraitGrade(trait)).toThrow();
  });

  it("의 수치는 등급이 오를수록 세진다", () => {
    for (const def of RUNE_TRAIT_DEFS) {
      const values = RUNE_TRAIT_GRADES.map((grade) => runeTraitValue(def.id, grade));
      // 출혈 연구만 **낮을수록 세다**(N회마다 한 번). 나머지는 모두 오른다.
      const rising = def.effect.kind === "bleedEveryNAttacks"
        ? values.every((value, index) => index === 0 || value < values[index - 1])
        : values.every((value, index) => index === 0 || value > values[index - 1]);
      expect(rising, def.id).toBe(true);
    }
  });

  it("은 열두 종이 모두 실제로 도는 전투 효과를 만든다", () => {
    for (const def of RUNE_TRAIT_DEFS) {
      const effects = runeTraitCombatEffects({ id: def.id, grade: "rare", upgradeMisses: 0 }, "anky");
      expect(effects.length, def.id).toBeGreaterThan(0);
      // 특성은 그 룬을 낀 렐릭 하나에만 걸린다 — 전체 범위가 새면 편성 전체가 함께 세진다.
      for (const effect of effects) expect(effect.scope).toEqual({ kind: "relic", relicId: "anky" });
    }
  });

  it("은 알 수 없는 ID에 효과를 만들지 않는다", () => {
    expect(runeTraitCombatEffects({ id: "no-such-trait", grade: "rare", upgradeMisses: 0 }, "anky")).toEqual([]);
  });
});
