/** 원정 증강이 영향을 주는 아군 범위다. 지정 효과는 저장된 렐릭 ID 하나만 고른다. */
export type ExpeditionAugmentScope =
  | { kind: "all" }
  | { kind: "relic"; relicId: string };

/** 전투 엔진이 해석하는 순수 효과다. 피해 공식과 출혈 상태 자체는 난전 엔진이 계속 소유한다. */
export type ExpeditionAugmentEffect =
  | { kind: "attackPowerPercent"; percent: number; scope: ExpeditionAugmentScope }
  | { kind: "bleedOnAttack"; percent: number; seconds: number; scope: ExpeditionAugmentScope };

/** 효과가 이 렐릭에 적용되는지 한 곳에서 판정해 전체/지정 범위가 섞이지 않게 한다. */
export function augmentAppliesTo(effect: ExpeditionAugmentEffect, relicId: string): boolean {
  return effect.scope.kind === "all" || effect.scope.relicId === relicId;
}

/** 여러 공격력 효과는 서로 더한 뒤 공용 피해 계산 결과에 한 번만 곱한다. */
export function attackPowerMultiplier(effects: readonly ExpeditionAugmentEffect[], relicId: string): number {
  const percent = effects
    .filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "attackPowerPercent" }> => effect.kind === "attackPowerPercent" && augmentAppliesTo(effect, relicId))
    .reduce((sum, effect) => sum + effect.percent, 0);
  return 1 + percent / 100;
}

/** 매 공격 출혈은 중복 상태를 만들지 않고 가장 강한 적용값 하나를 선택한다. */
export function bleedOnAttackEffect(effects: readonly ExpeditionAugmentEffect[], relicId: string): Extract<ExpeditionAugmentEffect, { kind: "bleedOnAttack" }> | undefined {
  return effects
    .filter((effect): effect is Extract<ExpeditionAugmentEffect, { kind: "bleedOnAttack" }> => effect.kind === "bleedOnAttack" && augmentAppliesTo(effect, relicId))
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
