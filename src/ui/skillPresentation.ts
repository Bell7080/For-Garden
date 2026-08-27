import type { CombatStatusEffect, FerocityTrait, Ultimate } from "../core/types";

/** 전투 좌표 수치 대신 플레이어가 전장에서 찾을 수 있는 대상 범위를 말한다. */
export function targetingLabel(targeting?: Ultimate["targeting"]): string | undefined {
  if (targeting === "single") return "적 한 명";
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적";
  return undefined;
}

/** 상태 효과 계약을 팝업과 테스트가 함께 쓰는 짧은 문구로 바꾼다. */
export function statusEffectLabel(effect?: CombatStatusEffect): string | undefined {
  if (effect?.kind === "stun") return `[[stun|기절]] ${effect.seconds}초`;
  return undefined;
}

/** 지속 회복 수치는 특정 캐릭터를 사전에 하드코딩하지 않고 현재 정의에서 만든다. */
export function recoveryLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `매초 최대 체력의 ${percent}% 회복`;
}

/** 폭주 설명의 모든 수치를 실제 전투 계약에서 만들어 밸런스 조정 후 문구가 남지 않게 한다. */
export function ferocityTraitDescription(trait: FerocityTrait): string {
  if (trait.effectId === "attackIntervalReduction") return `공격 간격이 ${trait.reductionPercent}% 짧아진다.`;
  if (trait.effectId === "damageReduction") return `받는 피해가 ${trait.reductionPercent}% 줄어든다.`;
  if (trait.effectId === "allyEnergyGain") return `공격할 때마다 다른 생존 아군이 궁극기 에너지를 ${trait.energy} 얻는다.`;
  if (trait.effectId === "criticalChanceBonus") return `치명타 확률이 ${trait.chancePercent}%p 오른다.`;
  if (trait.effectId === "teamMoveSpeedBonus") return `생존 아군 전체의 이동 속도가 ${trait.bonusPercent}% 빨라진다.`;

  // 방어력 계수는 토리카처럼 추가 피해가 있는 범위 타격만 노출하고, 일반 전이 특성은 원래 피해 비율만 보여 준다.
  const damage = trait.defenseDamagePercent === undefined
    ? `원래 피해의 ${trait.damagePercent}%`
    : `원래 피해의 ${trait.damagePercent}%와 방어력의 ${trait.defenseDamagePercent}%`;
  const effect = trait.statusEffect?.kind === "stun"
    ? `${damage}의 물리 피해를 주고, ${trait.statusEffect.seconds}초간 [[stagger|경직]]시킨다.`
    : `${damage}의 물리 피해를 준다.`;
  return `기본 공격이 대상 주위의 모든 적에게 ${effect}`;
}
