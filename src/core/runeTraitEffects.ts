/**
 * 룬 특성을 전투 진행기가 읽는 효과로 옮기는 유일한 경계다.
 *
 * **두 번째 조건부 효과 엔진을 만들지 않는다.** 원정 증강이 이미 「발동 시점 + payload +
 * 한도 + 범위」 계약을 갖고 전투가 그 시점들을 돌고 있으므로, 특성은 그 계약을 그대로 쓴다 —
 * 정적 데이터가 임의 코드를 실행하지 못하고, 같은 메커니즘이 두 곳에서 따로 자라지 않는다.
 *
 * 특성은 **그 룬을 낀 렐릭 하나**에만 걸리므로 범위는 언제나 `{ kind: "relic" }`이다.
 *
 * ## 중첩
 *
 * 같은 렐릭에 같은 특성이 여럿이면 **전투에 들어가기 전에 여기서** 한 번 정리한다(`resolveRuneTraitStacking`).
 * 합산형은 수치를 더해 효과 하나로, 독립형은 룬마다 효과를 따로, 중첩 불가는 가장 높은 등급 하나만 낸다.
 * 정리를 엔진 안에서 하지 않으므로 서버 재현과 화면이 같은 입력을 받는다.
 */

import type { ExpeditionAugmentEffect, ExpeditionAugmentLimits } from "./expeditionAugments";
import type { RuneInstance } from "./runes";
import { RUNE_TRAIT_GRADES, type RuneTrait, type RuneTraitGrade } from "./runeTraits";
import { findRuneTrait, type RuneTraitDefinition } from "../data/runeTraits";

/** 처치처럼 한 판에 여러 번 터지는 시점의 횟수 한도다. 막으면 뒤로 갈수록 특성이 없는 것과 같아진다. */
const UNLIMITED = Number.MAX_SAFE_INTEGER;

/** 한 판에 몇 번만 터지는 조건형의 공용 한도다. */
function limits(target: ExpeditionAugmentLimits["target"], maxTriggers = 1, cooldownSeconds = 0, maxStacks = 1): ExpeditionAugmentLimits {
  return { maxTriggers, cooldownSeconds, maxStacks, target };
}

/** 같은 특성이 한 렐릭에 붙은 룬 하나의 값 묶음이다. */
interface RuneTraitValues {
  /** 합산(상한 적용) 또는 한 룬의 수치다. */
  value: number;
  value2: number;
  /** 같은 특성을 가진 룬의 수다. */
  count: number;
}

/** 정의와 값 묶음으로 효과를 짓는다. 종류가 늘면 이 한 함수에 절을 더한다. */
function buildEffects(def: RuneTraitDefinition, { value, value2, count }: RuneTraitValues, relicId: string): ExpeditionAugmentEffect[] {
  const scope = { kind: "relic", relicId } as const;
  const effect = def.effect;
  switch (effect.kind) {
    case "hasteOnBattleStart":
      return [
        { kind: "triggered", trigger: "battleStart", scope, limits: limits("self"),
          payload: { kind: "haste", attackSpeedPercent: value, moveSpeedPercent: 0, seconds: effect.seconds } },
        // 처치하면 지속이 늘어난다 — 합계 상한은 한 판에 늘릴 수 있는 시간이다.
        { kind: "triggered", trigger: "onKill", scope, limits: limits("self", UNLIMITED),
          payload: { kind: "hasteExtend", seconds: effect.extendSeconds, maxExtraSeconds: effect.extendMaxSeconds } },
      ];
    case "hasteOnKill":
      return [{ kind: "triggered", trigger: "onKill", scope, limits: limits("self", UNLIMITED, 0, effect.maxStacks),
        payload: { kind: "haste", attackSpeedPercent: value, moveSpeedPercent: value, seconds: effect.seconds } }];
    case "currentHpStrike":
      return [{ kind: "currentHpStrike", percent: value, everyN: effect.everyNAttacks, attackCapPercent: effect.attackCapPercent, scope }];
    case "sameTargetStreak":
      return [{ kind: "sameTargetStreakPercent", percentPerStack: value, maxStacks: effect.maxStacks, carryOnKill: true, scope }];
    case "shieldLowestAllyOnBattleStart":
      return [{ kind: "triggered", trigger: "battleStart", scope, limits: limits("lowestHpAlly"), payload: { kind: "shield", maxHpPercent: value } }];
    case "shieldAndHasteOnLowHp":
      return [
        { kind: "triggered", trigger: "onLowHp", scope, limits: limits("self"), whenHpAtOrBelowPercent: effect.belowHpPercent, payload: { kind: "shield", maxHpPercent: value } },
        { kind: "triggered", trigger: "onLowHp", scope, limits: limits("self"), whenHpAtOrBelowPercent: effect.belowHpPercent,
          payload: { kind: "haste", attackSpeedPercent: value2, moveSpeedPercent: 0, seconds: effect.hasteSeconds } },
      ];
    case "healOverTimeOnLowHp":
      return [{ kind: "triggered", trigger: "onLowHp", scope, limits: limits("self"), whenHpAtOrBelowPercent: effect.belowHpPercent,
        payload: { kind: "heal", maxHpPercent: value, thenOverSeconds: effect.overSeconds } }];
    case "shieldOnCritical":
      return [{ kind: "triggered", trigger: "onCritical", scope, limits: limits("self", UNLIMITED, effect.cooldownSeconds), payload: { kind: "shield", maxHpPercent: value } }];
    case "openingCrits":
      return [{ kind: "openingCrits", count: value, scope }];
    case "openingEnergy":
      return [{ kind: "openingEnergyPercent", percent: value, scope }];
    case "ferocityOnKill":
      return [{ kind: "triggered", trigger: "onKill", scope, limits: limits("self", UNLIMITED, effect.cooldownSeconds), payload: { kind: "ferocity", maxPercent: value } }];
    case "bleedEveryNAttacks":
      return [{ kind: "bleedOnAttack", strength: "standard", everyNAttacks: value, reapplication: "refresh", scope }];
    case "hasteOnUltimate":
      return [{ kind: "triggered", trigger: "onUltimate", scope, limits: limits("self", UNLIMITED),
        payload: { kind: "haste", attackSpeedPercent: value, moveSpeedPercent: 0, seconds: effect.seconds } }];
    case "shieldOnUltimate":
      return [{ kind: "triggered", trigger: "onUltimate", scope, limits: limits("self", effect.maxTimes), payload: { kind: "shield", maxHpPercent: value } }];
    case "healOnKill":
      return [{ kind: "triggered", trigger: "onKill", scope, limits: limits("self", effect.maxTimes, effect.cooldownSeconds), payload: { kind: "heal", maxHpPercent: value } }];
    case "teamHasteOnBattleStart":
      return [{ kind: "triggered", trigger: "battleStart", scope, limits: limits("allAllies"),
        payload: { kind: "haste", attackSpeedPercent: value, moveSpeedPercent: 0, seconds: effect.seconds } }];
    case "healOnBasicHit":
      return [{ kind: "triggered", trigger: "onBasicHit", scope, limits: limits("self", effect.maxTimes, effect.cooldownSeconds), payload: { kind: "heal", maxHpPercent: value } }];
    case "staggerOnCritical":
      return [{ kind: "triggered", trigger: "onCritical", scope, limits: limits("hitTarget", UNLIMITED, value),
        payload: { kind: "status", status: { kind: "stagger", seconds: effect.staggerSeconds } } }];
    case "curseEveryNAttacks":
      return [{ kind: "curseOnAttack", everyNAttacks: value, scope }];
    case "nthBasicBonus":
      return [{ kind: "nthBasicBonusPercent", percent: value, everyN: effect.everyN, scope }];
    case "damageVsLowHp":
      return [{ kind: "damageVsLowHpPercent", percent: value, belowHpPercent: effect.belowHpPercent, scope }];
    case "critDamage":
      return [{ kind: "flatStat", stat: "critDamage", points: value, scope }];
    case "shieldedDamage":
      return [{ kind: "shieldedDamagePercent", percent: value, scope }];
    case "warmUp":
      return [{ kind: "warmUpHaste", percentPerStack: value, everySeconds: effect.everySeconds, maxStacks: effect.maxStacks, scope }];
    case "periodicCrit":
      // 같은 룬이 더 있을수록 주기가 1씩 줄어든다. 최소값 아래로는 내려가지 않는다.
      return [{ kind: "periodicCrit", everyN: Math.max(effect.minEvery, value - (count - 1)), scope }];
  }
}

/** 특성 한 줄이 만드는 전투 효과다. 같은 특성이 여럿인 경우의 정리는 `resolveRuneTraitStacking`이 맡는다. */
export function runeTraitCombatEffects(trait: RuneTrait, relicId: string): ExpeditionAugmentEffect[] {
  const def = findRuneTrait(trait.id);
  if (def === undefined) return [];
  return buildEffects(def, { value: def.values[trait.grade], value2: def.values2?.[trait.grade] ?? 0, count: 1 }, relicId);
}

/** 쪽지가 룬 하나에 붙일 중첩 표시다. 같은 특성을 가진 다른 룬이 있을 때만 의미가 있다. */
export type RuneTraitStackStatus = "active" | "ignored";

/**
 * 한 렐릭의 룬 특성들을 중첩 규칙대로 정리한다.
 *
 * 반환값의 `ignored`는 중첩 불가 특성이 겹쳐 **적용되지 않는** 룬(입력 순서의 인덱스)이다 — 쪽지가
 * 「중복 · 적용 안 됨」을 적는 근거다.
 */
export function resolveRuneTraitStacking(traits: readonly RuneTrait[], relicId: string): { effects: ExpeditionAugmentEffect[]; ignored: number[] } {
  const effects: ExpeditionAugmentEffect[] = [];
  const ignored: number[] = [];
  const groups = new Map<string, number[]>();
  traits.forEach((trait, index) => groups.set(trait.id, [...(groups.get(trait.id) ?? []), index]));
  for (const [id, indices] of groups) {
    const def = findRuneTrait(id);
    if (def === undefined) continue;
    const rank = (index: number): number => RUNE_TRAIT_GRADES.indexOf(traits[index].grade);
    if (def.stacking === "independent") {
      for (const index of indices) effects.push(...buildEffects(def, { value: def.values[traits[index].grade], value2: def.values2?.[traits[index].grade] ?? 0, count: 1 }, relicId));
    } else if (def.stacking === "none") {
      // 가장 높은 등급 하나. 같은 등급이면 먼저 낀 룬이 이긴다.
      const best = indices.reduce((top, index) => rank(index) > rank(top) ? index : top, indices[0]);
      for (const index of indices) if (index !== best) ignored.push(index);
      effects.push(...buildEffects(def, { value: def.values[traits[best].grade], value2: def.values2?.[traits[best].grade] ?? 0, count: 1 }, relicId));
    } else {
      const sum = (pick: (grade: RuneTraitGrade) => number): number => indices.reduce((total, index) => total + pick(traits[index].grade), 0);
      const value = Math.min(def.sumCap ?? Number.POSITIVE_INFINITY, sum((grade) => def.values[grade]));
      // 주기 확정 치명타는 합이 아니라 가장 높은 등급의 N에서 룬 수만큼 줄인다.
      const bestIndex = indices.reduce((top, index) => rank(index) > rank(top) ? index : top, indices[0]);
      const base = def.effect.kind === "periodicCrit" ? def.values[traits[bestIndex].grade] : value;
      effects.push(...buildEffects(def, { value: base, value2: sum((grade) => def.values2?.[grade] ?? 0), count: indices.length }, relicId));
    }
  }
  return { effects, ignored };
}

/**
 * 편성이 장착한 룬들에서 이번 전투가 쓸 효과를 모은다.
 *
 * 장착 목록을 읽는 일은 호출부(전투 입력을 만드는 씬·매니저)가 하고, 여기서는 **이미 고른
 * 룬만** 받는다 — 이 모듈이 세션을 읽으면 서버 재현과 테스트가 같은 입력을 만들 수 없다.
 */
export function partyRuneTraitEffects(equipped: ReadonlyArray<{ relicId: string; runes: readonly RuneInstance[] }>): ExpeditionAugmentEffect[] {
  return equipped.flatMap(({ relicId, runes }) =>
    resolveRuneTraitStacking(runes.flatMap((rune) => rune.trait === undefined ? [] : [rune.trait]), relicId).effects);
}
