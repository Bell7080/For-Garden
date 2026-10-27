import { getExpeditionAugment, type ExpeditionAugmentStacking } from "../data/expeditionAugments";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import type { CombatStatusEffect, DamageType } from "./types";

/** 정적 증강 데이터가 선택할 수 있는, 전투 진행기가 판별 가능한 발동 시점이다. */
export type ExpeditionAugmentTrigger = "battleStart" | "onBasicHit" | "onUltimateHit" | "onUltimateCast" | "onDamaged" | "onUltimate" | "onCritical" | "onKill" | "onLowHp" | "afterBattle";

/** 모든 조건부 효과가 공유하는 폭주 방지 계약이다. 0이나 생략값을 암묵적 무제한으로 해석하지 않는다. */
export interface ExpeditionAugmentLimits {
  maxTriggers: number;
  cooldownSeconds: number;
  maxStacks: number;
  /** `lowestHpAlly`는 발동 순간 체력 **비율**이 가장 낮은 살아 있는 아군 하나다. */
  target: "self" | "hitTarget" | "allAllies" | "lowestHpAlly";
}

/** 콜백 대신 공용 상태 계약 또는 수치만 담는 안전한 payload다. */
export type ExpeditionTriggeredPayload =
  | { kind: "shield"; maxHpPercent: number }
  | { kind: "status"; status: CombatStatusEffect }
  | { kind: "ferocity"; points: number }
  | { kind: "cleanse" }
  | { kind: "teamBuff"; buff: import("./types").TeamBuff }
  | { kind: "regeneration"; seconds: number; maxHpPercentPerSecond: number }
  | { kind: "stealth"; seconds: number }
  | { kind: "frozen"; seconds: number; maxHpPercentOnExpire: number }
  | { kind: "shell"; stacks: number; contract: NonNullable<import("./types").Passive["shellGuard"]> }
  | { kind: "reagent"; stacks: number; contract: import("./types").ReagentReaction }
  | { kind: "ultimateCostReduction"; percent: number }
  | { kind: "conditionalBonusDamage"; percent: number; damageType: DamageType; requiresStatus: "curse" | "stun" }
  | { kind: "lowHpDefense"; belowHpPercent: number; defensePercent: number; resistancePercent: number }
  /** `thenOverSeconds`가 있으면 즉시 회복 뒤 **같은 양**을 그 시간에 걸쳐 더 회복한다. */
  | { kind: "heal"; maxHpPercent: number; thenOverSeconds?: number }
  /** 야성 게이지를 최대치의 비율만큼 채운다. 폭주 중에는 공용 야성 경계가 무시한다. */
  | { kind: "ferocity"; maxPercent: number }
  /** 지금 걸린 룬 특성 가속이 있으면 남은 시간을 늘린다. `maxExtraSeconds`가 한 판의 늘림 합계 상한이다. */
  | { kind: "hasteExtend"; seconds: number; maxExtraSeconds: number }
  /**
   * 일정 시간 공격 속도·이동 속도.
   *
   * 순풍(`tailwind`)이나 광란(`frenzy`) 슬롯을 빌려 쓰지 않는다 — 둘 다 규칙어가 제 수치와
   * 부수 효과를 갖고 있어, 다른 수치로 걸면 머리 위 표식이 말하는 것과 실제가 갈린다.
   */
  | { kind: "haste"; attackSpeedPercent: number; moveSpeedPercent: number; seconds: number };

/** 런타임 훅은 이 구조만 해석하며 데이터가 임의 함수를 주입할 자리는 없다. */
export interface ExpeditionTriggeredEffect {
  kind: "triggered";
  trigger: ExpeditionAugmentTrigger;
  payload: ExpeditionTriggeredPayload;
  limits: ExpeditionAugmentLimits;
  scope: ExpeditionAugmentScope;
  /** `onLowHp`에서 소유자의 체력 비율이 이 값 이하일 때만 발동한다. 없으면 훅이 불린 순간 곧바로 발동한다. */
  whenHpAtOrBelowPercent?: number;
  /** 적중은 행동당 한 번만 센다. 대상 변경으로 초기화하지 않는다. */
  everyN?: number;
  applications?: number;
}

/** 원정 증강이 영향을 주는 아군 범위다. 지정 효과는 저장된 렐릭 ID 하나만 고른다. */
export type ExpeditionAugmentScope = { kind: "all" } | { kind: "relic"; relicId: string };

/** 전투 스냅샷에 한 번 합산할 수 있는 능력치 효과의 이름이다. */
export type ExpeditionAugmentStatKind =
  | "maxHpPercent" | "defensePercent" | "resistancePercent" | "attackPowerPercent"
  | "spellPowerPercent" | "attackSpeedPercent" | "moveSpeedPercent" | "initialShieldPercent" | "statusPotencyPercent";

/** 전투 엔진이 해석하는 순수 효과다. 정적 RelicDef가 아니라 매 전투 Fighter만 이 값을 소비한다. */
export type ExpeditionAugmentEffect =
  | { kind: ExpeditionAugmentStatKind; percent: number; scope: ExpeditionAugmentScope; stacking?: ExpeditionAugmentStacking; stackKey?: string }
  | { kind: "bleedOnAttack"; strength: "standard" | "minor"; everyNAttacks: number; reapplication: "refresh"; scope: ExpeditionAugmentScope }
  | { kind: "lowHpAttackPowerPercent"; percent: number; belowHpPercent: number; scope: ExpeditionAugmentScope }
  /** 표적의 현재 체력 비율이 기준 이상일 때만 얹히는 피해 증가율(%)이다. */
  | { kind: "damageVsHighHpPercent"; percent: number; aboveHpPercent: number; scope: ExpeditionAugmentScope }
  /** 같은 적을 연속으로 때린 겹마다 얹히는 피해 증가율(%)이다. 표적을 바꾸면 겹이 풀린다. */
  | { kind: "sameTargetStreakPercent"; percentPerStack: number; maxStacks: number; carryOnKill?: boolean; scope: ExpeditionAugmentScope }
  /**
   * 이미 퍼센트로 세는 능력치에 **덧셈**으로 붙는 가산이다.
   *
   * 곱셈 배율과 섞지 않는 이유는 같은 「+10」이 능력치마다 다른 크기가 되기 때문이다 —
   * 치명타 확률 가산이 패시브(`criticalChancePercent`)와 같은 문법으로 읽히게 한다.
   */
  | { kind: "flatStat"; stat: FlatStatKind; points: number; scope: ExpeditionAugmentScope }
  /** 표적의 현재 체력 비율이 기준 이하일 때만 얹히는 피해 증가율(%)이다. */
  | { kind: "damageVsLowHpPercent"; percent: number; belowHpPercent: number; scope: ExpeditionAugmentScope }
  /** 자신에게 보호막이 남아 있는 동안 주는 피해 증가율(%)이다. */
  | { kind: "shieldedDamagePercent"; percent: number; scope: ExpeditionAugmentScope }
  /** `everyN`번째 기본 공격마다 얹히는 피해 증가율(%)이다. */
  | { kind: "nthBasicBonusPercent"; percent: number; everyN: number; scope: ExpeditionAugmentScope }
  /** 전투를 시작하고 처음 `count`번의 기본 공격은 반드시 치명타다. */
  | { kind: "openingCrits"; count: number; scope: ExpeditionAugmentScope }
  /** 기본 공격 `everyN`번마다 반드시 치명타다. */
  | { kind: "periodicCrit"; everyN: number; scope: ExpeditionAugmentScope }
  /** 전투 시작 시 궁극기 게이지가 비용의 `percent`%만큼 찬 채로 시작한다. */
  | { kind: "openingEnergyPercent"; percent: number; scope: ExpeditionAugmentScope }
  /** 기본 공격 `everyN`번마다 표적의 **현재** 체력 비율만큼 추가 피해. 공격력 비례 상한이 있다. */
  | { kind: "currentHpStrike"; percent: number; everyN: number; attackCapPercent: number; scope: ExpeditionAugmentScope }
  /** 기본 공격 `everyNAttacks`번마다 저주를 건다. */
  | { kind: "curseOnAttack"; everyNAttacks: number; scope: ExpeditionAugmentScope }
  /** `everySeconds`초마다 공격 속도가 `percentPerStack`%씩 오른다. */
  | { kind: "warmUpHaste"; percentPerStack: number; everySeconds: number; maxStacks: number; scope: ExpeditionAugmentScope }
  | ExpeditionTriggeredEffect;

/** 덧셈으로 붙는 퍼센트 수치의 이름이다. */
export type FlatStatKind = "lifeSteal" | "critChance" | "ferocityGain" | "energyGain" | "critDamage";

/** 합산 결과는 배율로 반환해 호출부가 같은 효과를 두 번 적용하지 않게 한다. */
export type ExpeditionAugmentStatMultipliers = Record<ExpeditionAugmentStatKind, number>;
const STAT_KINDS: readonly ExpeditionAugmentStatKind[] = [
  "maxHpPercent", "defensePercent", "resistancePercent", "attackPowerPercent",
  "spellPowerPercent", "attackSpeedPercent", "moveSpeedPercent", "initialShieldPercent", "statusPotencyPercent",
];

/** 배열 포함 검사 뒤에도 판별 공용체를 안전하게 좁히는 능력치 효과 가드다. */
function isStatEffect(effect: ExpeditionAugmentEffect): effect is Extract<ExpeditionAugmentEffect, { kind: ExpeditionAugmentStatKind }> {
  return STAT_KINDS.includes(effect.kind as ExpeditionAugmentStatKind);
}

/** 효과가 이 렐릭에 적용되는지 한 곳에서 판정해 전체/지정 범위가 섞이지 않게 한다. */
export function augmentAppliesTo(effect: ExpeditionAugmentEffect, relicId: string): boolean {
  return effect.scope.kind === "all" || effect.scope.relicId === relicId;
}

/** 능력치별 운영 결합 규칙을 적용하고, 각 능력치에 한 번 곱할 배율로 바꾼다. */
export function expeditionAugmentStatMultipliers(effects: readonly ExpeditionAugmentEffect[], relicId: string): ExpeditionAugmentStatMultipliers {
  const totals = Object.fromEntries(STAT_KINDS.map((kind) => [kind, 0])) as Record<ExpeditionAugmentStatKind, number>;
  const groups = new Map<string, Extract<ExpeditionAugmentEffect, { kind: ExpeditionAugmentStatKind }>[] >();
  for (const effect of effects) {
    if (!isStatEffect(effect) || !augmentAppliesTo(effect, relicId)) continue;
    // 수동 전투 설정은 예전처럼 각 행을 가산하고, 카탈로그 효과만 ID별 운영 규칙으로 묶는다.
    const key = effect.stackKey ?? `${effect.kind}:unkeyed:${groups.size}`;
    groups.set(key, [...(groups.get(key) ?? []), effect]);
  }
  for (const effectsInGroup of groups.values()) {
    const [first] = effectsInGroup;
    const values = effectsInGroup.map(({ percent }) => percent);
    const stacking = first.stacking ?? { mode: "additive" as const };
    const combined = stacking.mode === "strongest"
      ? Math.max(...values)
      : stacking.mode === "additiveCapped"
        ? Math.min(stacking.capPercent, values.reduce((sum, value) => sum + value, 0))
        : values.reduce((sum, value) => sum + value, 0);
    totals[first.kind] += combined;
  }
  return Object.fromEntries(STAT_KINDS.map((kind) => [kind, 1 + totals[kind] / 100])) as ExpeditionAugmentStatMultipliers;
}

/** 기존 호출부를 위한 공격력 전용 별칭도 일반 누적기의 결과만 읽는다. */
export function attackPowerMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string): number {
  return expeditionAugmentStatMultipliers(effects, relicId).attackPowerPercent;
}

/** 체력 조건을 만족한 공격력 효과만 합산한다. 상시 능력치 스냅샷과 분리해 전투 중 변화를 따른다. */
export function conditionalAttackPowerMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string, hpPercent: number): number {
  const percent = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "lowHpAttackPowerPercent" }> =>
    effect.kind === "lowHpAttackPowerPercent" && augmentAppliesTo(effect, relicId) && hpPercent <= effect.belowHpPercent)
    .reduce((sum, effect) => sum + effect.percent, 0);
  return 1 + percent / 100;
}

/**
 * 공격 출혈은 명시된 강도, 발동 빈도, 지속시간, 재적용 계약 순으로 비교한다.
 * 단순 총 피해량만 비교하면 느리게 발동하는 강한 출혈과 잦은 약한 출혈의 슬롯 우선권이 뒤집힌다.
 */
export function bleedOnAttackEffect(effects: readonly ExpeditionAugmentEffect[], relicId: string): Extract<ExpeditionAugmentEffect, { kind: "bleedOnAttack" }> | undefined {
  const strengthRank = { minor: 0, standard: 1 } as const;
  const reapplicationRank = { refresh: 1 } as const;
  return effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "bleedOnAttack" }> => effect.kind === "bleedOnAttack" && augmentAppliesTo(effect, relicId))
    .sort((a, b) => strengthRank[b.strength] - strengthRank[a.strength]
      || a.everyNAttacks - b.everyNAttacks
      || reapplicationRank[b.reapplication] - reapplicationRank[a.reapplication])[0];
}

/** 휴식 노드가 다루는 저장 스냅샷은 HP를 0~100 비율로 보관한다. */
export interface ExpeditionRelicHealth { relicId: string; currentHp: number; alive: boolean }

/** 중복 회복 증강은 단순 합산하되 한 전투당 최대 50%까지만 허용해 무한 유지 조합을 막는다. */
export const EXPEDITION_AFTER_BATTLE_HEAL_CAP_PERCENT = 50;

/** 전체 대상 전투 후 회복만 골라 합산하며, 손상된 개인 대상 저장은 회복으로 해석하지 않는다. */
export function expeditionAfterBattleHealPercent(selections: readonly ExpeditionAugmentSelection[]): number {
  const total = selections.reduce((sum, selection) => {
    const augment = getExpeditionAugment(selection.augmentId);
    // 회복 증강은 운영 데이터상 전체 대상이며 targetRelicId가 있으면 변조된 선택이므로 제외한다.
    return augment?.target === "party" && augment.effect.kind === "healAfterBattlePercent" && selection.targetRelicId === undefined
      ? sum + augment.effect.percent
      : sum;
  }, 0);
  return Math.min(EXPEDITION_AFTER_BATTLE_HEAL_CAP_PERCENT, total);
}

/** 검증 완료된 전투 HP에 회복을 적용하되 생존 상태를 바꾸거나 100%를 넘기지 않는다. */
export function applyExpeditionAfterBattleHeal(relics: readonly ExpeditionRelicHealth[], healPercent: number): ExpeditionRelicHealth[] {
  return relics.map((relic) => relic.alive && relic.currentHp > 0
    ? { ...relic, currentHp: Math.min(100, relic.currentHp + healPercent) }
    : { ...relic, currentHp: 0, alive: false });
}

/** 전멸 뒤의 우회 부활을 막고, 생존자가 있을 때만 생존자 회복과 첫 사망자 부활을 적용한다. */
export function applyExpeditionRest(relics: readonly ExpeditionRelicHealth[], healPercent = 30, revivePercent = 25): ExpeditionRelicHealth[] {
  if (!relics.some(({ alive, currentHp }) => alive && currentHp > 0)) return relics.map((relic) => ({ ...relic, currentHp: 0, alive: false }));
  let revived = false;
  return relics.map((relic) => {
    if (relic.alive && relic.currentHp > 0) return { ...relic, currentHp: Math.min(100, relic.currentHp + healPercent), alive: true };
    if (!revived) { revived = true; return { ...relic, currentHp: revivePercent, alive: true }; }
    return { ...relic, currentHp: 0, alive: false };
  });
}

/** 조건이 맞는 표적에게만 얹히는 피해 증가율을 배율로 합산한다. 조건이 없으면 1이다. */
export function highHpDamageMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string, targetHpPercent: number): number {
  const percent = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "damageVsHighHpPercent" }> =>
    effect.kind === "damageVsHighHpPercent" && augmentAppliesTo(effect, relicId) && targetHpPercent >= effect.aboveHpPercent)
    .reduce((sum, effect) => sum + effect.percent, 0);
  return 1 + percent / 100;
}

/** 연속 타격 겹이 만드는 피해 배율이다. 겹은 호출부가 세고 상한은 효과가 정한다. */
export function sameTargetStreakMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string, stacks: number): number {
  const percent = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "sameTargetStreakPercent" }> =>
    effect.kind === "sameTargetStreakPercent" && augmentAppliesTo(effect, relicId))
    .reduce((sum, effect) => sum + effect.percentPerStack * Math.min(Math.max(0, stacks), effect.maxStacks), 0);
  return 1 + percent / 100;
}

/** 퍼센트 능력치에 덧셈으로 붙는 가산의 합이다. 능력치마다 한 번씩만 더한다. */
export function flatStatPoints(effects: readonly ExpeditionAugmentEffect[], relicId: string, stat: FlatStatKind): number {
  return effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "flatStat" }> =>
    effect.kind === "flatStat" && effect.stat === stat && augmentAppliesTo(effect, relicId))
    .reduce((sum, effect) => sum + effect.points, 0);
}

/** 표적의 체력이 기준 이하일 때 얹히는 피해 배율이다. */
export function lowHpDamageMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string, targetHpPercent: number): number {
  const percent = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "damageVsLowHpPercent" }> =>
    effect.kind === "damageVsLowHpPercent" && augmentAppliesTo(effect, relicId) && targetHpPercent <= effect.belowHpPercent)
    .reduce((sum, effect) => sum + effect.percent, 0);
  return 1 + percent / 100;
}

/** 보호막이 남아 있는 동안의 피해 배율이다. */
export function shieldedDamageMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string, shielded: boolean): number {
  if (!shielded) return 1;
  const percent = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "shieldedDamagePercent" }> =>
    effect.kind === "shieldedDamagePercent" && augmentAppliesTo(effect, relicId)).reduce((sum, effect) => sum + effect.percent, 0);
  return 1 + percent / 100;
}

/** 기본 공격 `attackNumber`번째(1부터)에 얹히는 주기 피해 배율이다. */
export function nthBasicBonusMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string, attackNumber: number): number {
  const percent = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "nthBasicBonusPercent" }> =>
    effect.kind === "nthBasicBonusPercent" && augmentAppliesTo(effect, relicId) && attackNumber % effect.everyN === 0)
    .reduce((sum, effect) => sum + effect.percent, 0);
  return 1 + percent / 100;
}

/** 시간이 쌓는 가속(달아오름)의 공격 속도 증가율(%)이다. 겹은 흐른 시간에서 바로 나오므로 저장하지 않는다. */
export function warmUpAttackSpeedPercent(effects: readonly ExpeditionAugmentEffect[], relicId: string, elapsedSeconds: number): number {
  return effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "warmUpHaste" }> =>
    effect.kind === "warmUpHaste" && augmentAppliesTo(effect, relicId))
    .reduce((sum, effect) => sum + effect.percentPerStack * Math.min(effect.maxStacks, Math.floor(Math.max(0, elapsedSeconds) / effect.everySeconds)), 0);
}

/** 개막 확정 치명타 횟수의 합이다. */
export function openingCritCount(effects: readonly ExpeditionAugmentEffect[], relicId: string): number {
  return effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "openingCrits" }> =>
    effect.kind === "openingCrits" && augmentAppliesTo(effect, relicId)).reduce((sum, effect) => sum + effect.count, 0);
}

/** 주기 확정 치명타 중 가장 짧은 주기다. 없으면 undefined다. */
export function periodicCritEvery(effects: readonly ExpeditionAugmentEffect[], relicId: string): number | undefined {
  const every = effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "periodicCrit" }> =>
    effect.kind === "periodicCrit" && augmentAppliesTo(effect, relicId)).map(({ everyN }) => everyN);
  return every.length === 0 ? undefined : Math.min(...every);
}
