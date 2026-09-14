/**
 * 룬 특성을 전투 진행기가 읽는 효과로 옮기는 유일한 경계다.
 *
 * **두 번째 조건부 효과 엔진을 만들지 않는다.** 원정 증강이 이미 「발동 시점 + payload +
 * 한도 + 범위」 계약을 갖고 전투가 그 시점들을 돌고 있으므로, 특성은 그 계약을 그대로 쓴다 —
 * 정적 데이터가 임의 코드를 실행하지 못하고, 같은 메커니즘이 두 곳에서 따로 자라지 않는다.
 *
 * 특성은 **그 룬을 낀 렐릭 하나**에만 걸리므로 범위는 언제나 `{ kind: "relic" }`이다.
 */

import type { ExpeditionAugmentEffect, ExpeditionAugmentLimits } from "./expeditionAugments";
import type { RuneInstance } from "./runes";
import type { RuneTrait } from "./runeTraits";
import { findRuneTrait, runeTraitValue } from "../data/runeTraits";

/** 한 판에 한 번만 터지는 조건형의 공용 한도다. */
function onceLimits(target: ExpeditionAugmentLimits["target"], cooldownSeconds = 0): ExpeditionAugmentLimits {
  return { maxTriggers: 1, cooldownSeconds, maxStacks: 1, target };
}

/** 특성 한 줄이 만드는 전투 효과다. 종류가 늘면 이 한 함수에 절을 더한다. */
export function runeTraitCombatEffects(trait: RuneTrait, relicId: string): ExpeditionAugmentEffect[] {
  const def = findRuneTrait(trait.id);
  if (def === undefined) return [];
  const value = runeTraitValue(trait.id, trait.grade);
  const scope = { kind: "relic", relicId } as const;
  switch (def.effect.kind) {
    case "hasteOnBattleStart":
      return [{ kind: "triggered", trigger: "battleStart", scope, limits: onceLimits("self"),
        payload: { kind: "haste", attackSpeedPercent: value, moveSpeedPercent: 0, seconds: def.effect.seconds } }];
    case "hasteOnKill":
      // 처치는 한 판에 여러 번이라 횟수를 막지 않는다 — 막으면 뒤로 갈수록 특성이 없는 것과 같아진다.
      return [{ kind: "triggered", trigger: "onKill", scope,
        limits: { maxTriggers: Number.MAX_SAFE_INTEGER, cooldownSeconds: def.effect.cooldownSeconds, maxStacks: 1, target: "self" },
        payload: { kind: "haste", attackSpeedPercent: value, moveSpeedPercent: value, seconds: def.effect.seconds } }];
    case "damageVsHighHp":
      return [{ kind: "damageVsHighHpPercent", percent: value, aboveHpPercent: def.effect.aboveHpPercent, scope }];
    case "sameTargetStreak":
      return [{ kind: "sameTargetStreakPercent", percentPerStack: value, maxStacks: def.effect.maxStacks, scope }];
    case "shieldLowestAllyOnBattleStart":
      return [{ kind: "triggered", trigger: "battleStart", scope, limits: onceLimits("lowestHpAlly"),
        payload: { kind: "shield", maxHpPercent: value } }];
    case "shieldOnLowHp":
      return [{ kind: "triggered", trigger: "onLowHp", scope, limits: onceLimits("self"),
        payload: { kind: "shield", maxHpPercent: value } }];
    case "healOnLowHp":
      return [{ kind: "triggered", trigger: "onLowHp", scope, limits: onceLimits("self"),
        payload: { kind: "heal", maxHpPercent: value } }];
    case "shieldOnCritical":
      return [{ kind: "triggered", trigger: "onCritical", scope,
        limits: { maxTriggers: Number.MAX_SAFE_INTEGER, cooldownSeconds: def.effect.cooldownSeconds, maxStacks: 1, target: "self" },
        payload: { kind: "shield", maxHpPercent: value } }];
    case "flatStat":
      return [{ kind: "flatStat", stat: def.effect.stat, points: value, scope }];
    case "bleedEveryNAttacks":
      return [{ kind: "bleedOnAttack", strength: "standard", everyNAttacks: value, reapplication: "refresh", scope }];
  }
}

/**
 * 편성이 장착한 룬들에서 이번 전투가 쓸 효과를 모은다.
 *
 * 장착 목록을 읽는 일은 호출부(전투 입력을 만드는 씬·매니저)가 하고, 여기서는 **이미 고른
 * 룬만** 받는다 — 이 모듈이 세션을 읽으면 서버 재현과 테스트가 같은 입력을 만들 수 없다.
 */
export function partyRuneTraitEffects(equipped: ReadonlyArray<{ relicId: string; runes: readonly RuneInstance[] }>): ExpeditionAugmentEffect[] {
  return equipped.flatMap(({ relicId, runes }) => runes.flatMap((rune) =>
    rune.trait === undefined ? [] : runeTraitCombatEffects(rune.trait, relicId)));
}
