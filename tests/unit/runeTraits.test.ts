import { describe, expect, it } from "vitest";
import {
  canUpgradeRuneTraitGrade, grantRuneTrait, nextRuneTraitGrade, rerollRuneTrait,
  RUNE_TRAIT_GRADES, RUNE_TRAIT_RULES, pickRuneTraitId, runeTraitIdsForGrade, upgradeRuneTraitGrade, canGrantRuneTraitAtLeast, type RuneTrait,
} from "../../src/core/runeTraits";
import { RUNE_TRAIT_DEFS, RUNE_TRAIT_IDS, RUNE_TRAIT_POOL, runeTraitValue } from "../../src/data/runeTraits";
import { runeTraitCombatEffects, resolveRuneTraitStacking } from "../../src/core/runeTraitEffects";
import { backfillStarterRuneTraits, createStarterRunes, STARTER_RUNE_TRAITED } from "../../src/data/runes";
import { assertValidRuneInstance } from "../../src/core/runes";

/** 정해진 순서대로 돌려주는 난수. 마지막 값에서 멈춘다. */
function scripted(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe("룬 특성", () => {
  it("은 부여한 최소 등급 아래로 내려가지 않는다", () => {
    for (const minimumGrade of RUNE_TRAIT_GRADES) {
      const trait = grantRuneTrait({ pool: RUNE_TRAIT_POOL, minimumGrade, random: scripted([0.999, 0.5]) });
      expect(RUNE_TRAIT_GRADES.indexOf(trait.grade)).toBeGreaterThanOrEqual(RUNE_TRAIT_GRADES.indexOf(minimumGrade));
      expect(RUNE_TRAIT_IDS).toContain(trait.id);
    }
  });

  it("의 재해석은 등급을 내리지 않는다", () => {
    const trait: RuneTrait = { id: "vanguard", grade: "epic", upgradeMisses: 0 };
    // 상승 판정과 종류 추첨 모두 가장 불리한 난수를 준다.
    const outcome = rerollRuneTrait({ trait, pool: RUNE_TRAIT_POOL, random: scripted([0.999, 0.5]) });
    expect(outcome.upgraded).toBe(false);
    expect(outcome.candidate.grade).toBe("epic");
  });

  it("의 천장은 연속 실패가 임계에 닿는 재해석에서 확정으로 올린다", () => {
    const threshold = RUNE_TRAIT_RULES.pityThreshold.uncommon;
    const trait: RuneTrait = { id: "vanguard", grade: "uncommon", upgradeMisses: threshold - 1 };
    const outcome = rerollRuneTrait({ trait, pool: RUNE_TRAIT_POOL, random: scripted([0.999, 0.5]) });
    expect(outcome.byPity).toBe(true);
    expect(outcome.upgraded).toBe(true);
    expect(outcome.candidate.grade).toBe("rare");
    // 등급이 오르면 천장은 새 등급에서 다시 돈다.
    expect(outcome.candidate.upgradeMisses).toBe(0);
  });

  it("의 실패는 쌓이고 성공은 초기화한다", () => {
    const trait: RuneTrait = { id: "vanguard", grade: "rare", upgradeMisses: 3 };
    const missed = rerollRuneTrait({ trait, pool: RUNE_TRAIT_POOL, random: scripted([0.999, 0.5]) });
    expect(missed.candidate.upgradeMisses).toBe(4);
    const hit = rerollRuneTrait({ trait, pool: RUNE_TRAIT_POOL, random: scripted([0, 0.5]) });
    expect(hit.upgraded).toBe(true);
    expect(hit.candidate.upgradeMisses).toBe(0);
  });

  it("의 전설은 더 오르지 않는다", () => {
    const trait: RuneTrait = { id: "vanguard", grade: "legendary", upgradeMisses: 99 };
    expect(nextRuneTraitGrade("legendary")).toBeUndefined();
    expect(canUpgradeRuneTraitGrade(trait)).toBe(false);
    expect(rerollRuneTrait({ trait, pool: RUNE_TRAIT_POOL, random: scripted([0, 0.5]) }).upgraded).toBe(false);
    expect(() => upgradeRuneTraitGrade(trait)).toThrow();
  });

  it("의 완전 복원 결정은 어느 등급에서든 곧장 전설로 올린다", () => {
    for (const grade of ["uncommon", "rare", "epic"] as const) {
      const upgraded = upgradeRuneTraitGrade({ id: "pursuit", grade, upgradeMisses: 7 });
      expect(upgraded).toEqual({ id: "pursuit", grade: "legendary", upgradeMisses: 0 });
    }
  });

  it("의 영웅 이상 확정 부여는 이미 영웅 이상인 특성에는 쓰지 않는다", () => {
    expect(canGrantRuneTraitAtLeast(undefined, "epic")).toBe(true);
    expect(canGrantRuneTraitAtLeast({ id: "pursuit", grade: "rare", upgradeMisses: 0 }, "epic")).toBe(true);
    expect(canGrantRuneTraitAtLeast({ id: "pursuit", grade: "epic", upgradeMisses: 0 }, "epic")).toBe(false);
    expect(canGrantRuneTraitAtLeast({ id: "pursuit", grade: "legendary", upgradeMisses: 0 }, "epic")).toBe(false);
  });

  it("의 수치는 등급이 오를수록 세진다", () => {
    for (const def of RUNE_TRAIT_DEFS) {
      const from = RUNE_TRAIT_GRADES.indexOf(def.minGrade);
      const values = RUNE_TRAIT_GRADES.slice(from).map((grade) => runeTraitValue(def.id, grade));
      // N회마다 한 번 터지는 특성은 **낮을수록 세다**. 나머지는 모두 오른다.
      const rising = ["bleedEveryNAttacks", "curseEveryNAttacks", "staggerOnCritical"].includes(def.effect.kind)
        ? values.every((value, index) => index === 0 || value < values[index - 1])
        : values.every((value, index) => index === 0 || value >= values[index - 1]);
      expect(rising, def.id).toBe(true);
      // 모든 등급이 같은 값인 특성은 전설 전용(완벽한 조준)처럼 등급이 아니라 개수가 키우는 것뿐이다.
      if (def.minGrade !== "legendary") expect(values[values.length - 1], def.id).not.toBe(values[0]);
    }
  });

  it("은 모든 종이 실제로 도는 전투 효과를 만든다", () => {
    for (const def of RUNE_TRAIT_DEFS) {
      const effects = runeTraitCombatEffects({ id: def.id, grade: "legendary", upgradeMisses: 0 }, "torika");
      expect(effects.length, def.id).toBeGreaterThan(0);
      // 특성은 그 룬을 낀 렐릭 하나에만 걸린다 — 전체 범위가 새면 편성 전체가 함께 세진다.
      for (const effect of effects) expect(effect.scope).toEqual({ kind: "relic", relicId: "torika" });
    }
  });

  it("은 임시 지급 룬의 절반에만 붙고 이미 붙은 것을 덮지 않는다", () => {
    const runes = createStarterRunes(scripted([0.42, 0.13, 0.77, 0.31]));
    const traited = runes.filter(({ trait }) => trait !== undefined);
    expect(traited).toHaveLength(STARTER_RUNE_TRAITED.filter(Boolean).length);
    expect(traited.length * 2).toBe(runes.length);
    for (const rune of runes) assertValidRuneInstance(rune);
    // 이미 굴려 둔 특성은 보충이 건드리지 않는다 — 덮으면 쌓아 둔 천장 실패 횟수까지 사라진다.
    const kept = runes[0].trait;
    const stripped = runes.map((rune, index) => index === 2 ? { ...rune, trait: undefined } : rune);
    const refilled = backfillStarterRuneTraits(stripped, scripted([0.5, 0.5]));
    expect(refilled[0].trait).toEqual(kept);
    expect(refilled[2].trait).toBeDefined();
    // 비워 둔 자리는 보충 뒤에도 비어 있다 — 절반만 특성을 달고 오는 구성이 무너지면 부여를 시험할 룬이 없다.
    expect(refilled.filter(({ trait }) => trait !== undefined)).toHaveLength(traited.length);
  });

  it("은 알 수 없는 ID에 효과를 만들지 않는다", () => {
    expect(runeTraitCombatEffects({ id: "no-such-trait", grade: "rare", upgradeMisses: 0 }, "torika")).toEqual([]);
  });

  it("의 풀은 등급이 자격을 정하고 전설 전용은 전설에서만 나온다", () => {
    const uncommon = runeTraitIdsForGrade(RUNE_TRAIT_POOL, "uncommon");
    expect(uncommon).not.toContain("perfectAim");
    expect(uncommon).not.toContain("overflow");
    expect(runeTraitIdsForGrade(RUNE_TRAIT_POOL, "epic")).toContain("overflow");
    expect(runeTraitIdsForGrade(RUNE_TRAIT_POOL, "epic")).not.toContain("perfectAim");
    expect(runeTraitIdsForGrade(RUNE_TRAIT_POOL, "legendary")).toContain("perfectAim");
    // 전설이 굴러 전용 몫에 걸리면(첫 난수가 몫 아래) 전용 풀에서만 고른다.
    expect(pickRuneTraitId(RUNE_TRAIT_POOL, "legendary", scripted([0, 0]), 0.35)).toBe("perfectAim");
    expect(pickRuneTraitId(RUNE_TRAIT_POOL, "epic", scripted([0]), 0.35)).not.toBe("perfectAim");
  });

  it("의 중첩은 합산·독립·불가를 갈라 정리한다", () => {
    const trait = (id: string, grade: RuneTrait["grade"] = "rare"): RuneTrait => ({ id, grade, upgradeMisses: 0 });
    // 중첩 불가: 가장 높은 등급 하나만 효과를 내고 나머지는 무시된다.
    const none = resolveRuneTraitStacking([trait("hemorrhage", "uncommon"), trait("hemorrhage", "epic")], "torika");
    expect(none.ignored).toEqual([0]);
    expect(none.effects).toHaveLength(runeTraitCombatEffects(trait("hemorrhage", "epic"), "torika").length);
    // 독립형: 룬마다 효과가 따로 선다.
    const one = runeTraitCombatEffects(trait("riposte"), "torika").length;
    expect(resolveRuneTraitStacking([trait("riposte"), trait("riposte")], "torika").effects).toHaveLength(one * 2);
    // 합산형: 효과 수는 그대로이고 수치만 더해진다.
    const sum = resolveRuneTraitStacking([trait("rhythm"), trait("rhythm")], "torika").effects;
    expect(sum).toHaveLength(runeTraitCombatEffects(trait("rhythm"), "torika").length);
  });
});
