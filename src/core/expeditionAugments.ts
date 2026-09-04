/** 원정 증강이 영향을 주는 아군 범위다. 지정 효과는 저장된 렐릭 ID 하나만 고른다. */
export type ExpeditionAugmentScope = { kind: "all" } | { kind: "relic"; relicId: string };

/** 전투 스냅샷에 한 번 합산할 수 있는 능력치 효과의 이름이다. */
export type ExpeditionAugmentStatKind =
  | "maxHpPercent" | "defensePercent" | "resistancePercent" | "attackPowerPercent"
  | "spellPowerPercent" | "attackSpeedPercent" | "initialShieldPercent" | "statusPotencyPercent";

/** 전투 엔진이 해석하는 순수 효과다. 정적 RelicDef가 아니라 매 전투 Fighter만 이 값을 소비한다. */
export type ExpeditionAugmentEffect =
  | { kind: ExpeditionAugmentStatKind; percent: number; scope: ExpeditionAugmentScope }
  | { kind: "bleedOnAttack"; percent: number; seconds: number; scope: ExpeditionAugmentScope }
  | { kind: "lowHpAttackPowerPercent"; percent: number; belowHpPercent: number; scope: ExpeditionAugmentScope };

/** 합산 결과는 배율로 반환해 호출부가 같은 효과를 두 번 적용하지 않게 한다. */
export type ExpeditionAugmentStatMultipliers = Record<ExpeditionAugmentStatKind, number>;
const STAT_KINDS: readonly ExpeditionAugmentStatKind[] = [
  "maxHpPercent", "defensePercent", "resistancePercent", "attackPowerPercent",
  "spellPowerPercent", "attackSpeedPercent", "initialShieldPercent", "statusPotencyPercent",
];

/** 효과가 이 렐릭에 적용되는지 한 곳에서 판정해 전체/지정 범위가 섞이지 않게 한다. */
export function augmentAppliesTo(effect: ExpeditionAugmentEffect, relicId: string): boolean {
  return effect.scope.kind === "all" || effect.scope.relicId === relicId;
}

/** 능력치별 단순 백분율을 각각 합산하고, 각 능력치에 한 번 곱할 배율로 바꾼다. */
export function expeditionAugmentStatMultipliers(effects: readonly ExpeditionAugmentEffect[], relicId: string): ExpeditionAugmentStatMultipliers {
  const totals = Object.fromEntries(STAT_KINDS.map((kind) => [kind, 0])) as Record<ExpeditionAugmentStatKind, number>;
  for (const effect of effects) {
    if (STAT_KINDS.includes(effect.kind as ExpeditionAugmentStatKind) && augmentAppliesTo(effect, relicId)) {
      totals[effect.kind as ExpeditionAugmentStatKind] += effect.percent;
    }
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

/** 매 공격 출혈은 중복 상태를 만들지 않고 가장 강한 적용값 하나를 선택한다. */
export function bleedOnAttackEffect(effects: readonly ExpeditionAugmentEffect[], relicId: string): Extract<ExpeditionAugmentEffect, { kind: "bleedOnAttack" }> | undefined {
  return effects.filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "bleedOnAttack" }> => effect.kind === "bleedOnAttack" && augmentAppliesTo(effect, relicId))
    .sort((a, b) => (b.percent * b.seconds) - (a.percent * a.seconds))[0];
}

/** 휴식 노드가 다루는 저장 스냅샷은 HP를 0~100 비율로 보관한다. */
export interface ExpeditionRelicHealth { relicId: string; currentHp: number; alive: boolean }

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
