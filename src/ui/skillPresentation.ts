import type { DamagePreview } from "../core/damage";
import type { KeywordDef } from "../data/keywords";
import type { KeywordTextOptions } from "../managers/KeywordManager";
import type { CombatStatusEffect, FerocityTrait, Passive, Ultimate } from "../core/types";

/** 전투 좌표 수치 대신 플레이어가 전장에서 찾을 수 있는 대상 범위를 말한다. */
export function targetingLabel(targeting?: Ultimate["targeting"]): string | undefined {
  if (targeting === "single") return "적 한 명";
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적";
  if (targeting === "battlefieldEnemies") return "전장의 모든 적";
  return undefined;
}

/** 상태 효과 계약을 팝업과 테스트가 함께 쓰는 짧은 문구로 바꾼다. */
export function statusEffectLabel(effect?: CombatStatusEffect): string | undefined {
  if (effect?.kind === "stun") return `[[stun|기절]] ${effect.seconds}초`;
  // 경직은 항상 0.1초인 용어 규칙을 키워드 설명이 담당하므로 요약줄에서 시간을 중복하지 않는다.
  if (effect?.kind === "stagger") return "[[stagger|경직]]";
  if (effect?.kind === "bleed") return `[[bleed|출혈]] ${effect.seconds}초 · 매초 최대 체력 ${effect.maxHpPercentPerSecond}%`;
  return undefined;
}

/** 지속 회복 수치는 특정 캐릭터를 사전에 하드코딩하지 않고 현재 정의에서 만든다. */
export function recoveryLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `매초 최대 체력의 ${percent}% 회복`;
}

/** 어느 캐릭터나 같은 양식으로 피해 수치의 능력치 출처와 적용 배율을 열어 볼 수 있게 한다. */
export function damageKeyword(preview?: DamagePreview): KeywordDef | undefined {
  if (preview?.kind !== "scaling") return undefined;
  return {
    id: "damage-value",
    term: String(preview.amount),
    kind: "규칙",
    description: `현재 ${preview.stat}에서 ${preview.power}%를 받아 계산한 피해 수치다.`,
  };
}

/** 요약과 본문이 같은 동적 키워드 사전을 쓰도록 순수 레이아웃 옵션을 한 경계에서 결합한다. */
export function skillKeywordLayoutOptions(
  skill: { contextualKeywords?: readonly KeywordDef[] },
  options: Omit<KeywordTextOptions, "contextualKeywords">,
): KeywordTextOptions {
  return { ...options, contextualKeywords: skill.contextualKeywords };
}

/** 폭주 설명의 모든 수치를 실제 전투 계약에서 만들어 밸런스 조정 후 문구가 남지 않게 한다. */
export function ferocityTraitDescription(trait: FerocityTrait, defense?: number): string {
  if (trait.effectId === "attackIntervalReduction") return `공격 간격이 ${trait.reductionPercent}% 짧아진다.`;
  if (trait.effectId === "damageReduction") return `받는 피해가 ${trait.reductionPercent}% 줄어든다.`;
  if (trait.effectId === "allyEnergyGain") return `공격할 때마다 다른 생존 아군이 궁극기 에너지를 ${trait.energy} 얻는다.`;
  // 덧셈형 확률도 플레이어에게는 일반적인 퍼센트 기호로 보여 주고 내부 산술 단위는 노출하지 않는다.
  if (trait.effectId === "criticalChanceBonus") return `치명타 확률이 ${trait.chancePercent}% 오른다.`;
  if (trait.effectId === "teamMoveSpeedBonus") return `생존 아군 전체의 이동 속도가 ${trait.bonusPercent}% 빨라진다.`;
  if (trait.effectId === "rexBattleQueen") return `치명타 확률과 모든 피해 흡혈이 각각 ${trait.criticalChancePoints}%, ${trait.allDamageLifeStealPoints}% 증가한다.`;
  if (trait.effectId === "stealthLeap") return `체력 비율이 가장 낮은 적에게 도약해 ${trait.durationSeconds}초 동안 단일 대상으로 지정되지 않는다.`;

  // 방어력 계수는 토리카처럼 추가 피해가 있는 범위 타격만 노출하고, 일반 전이 특성은 원래 피해 비율만 보여 준다.
  const speed = trait.attackSpeedBonusPercent === undefined ? "" : `공격 속도가 ${trait.attackSpeedBonusPercent}% 증가한다. `;
  const converted = trait.defenseDamagePercent === undefined || defense === undefined
    ? undefined
    : Math.round(defense * trait.defenseDamagePercent / 100);
  const bonus = trait.defenseDamagePercent === undefined
    ? `원래 피해의 ${trait.damagePercent}%`
    : `${converted === undefined ? "추가" : `[[damage-value|${converted}]]만큼 추가`} 물리 피해`;
  const ending = trait.statusEffect?.kind === "stagger"
    ? `${bonus}를 입히고 [[stagger|경직]]시킨다.`
    : `${bonus}를 입힌다.`;
  return `${speed}기본 공격이 대상 주위의 모든 적에게 적중해 ${ending}`;
}

/** 복합 능력 패시브를 각 구조화 수치에서 문장화해 데이터 변경이 본문에도 즉시 반영되게 한다. */
export function passiveDescription(passive: Passive): string {
  if (passive.kind === "basicHitAttackSpeedStack") return `기본 공격이 실제 적중할 때마다 이번 전투 동안 공격 속도가 ${passive.value} 증가한다.`;
  if (passive.kind !== "battleMaidMastery") return passive.desc;
  return `공격 속도·공격력·치명타 확률·치명타 피해가 각각 ${passive.attackSpeedPercent}%, ${passive.attackPowerPercent}%, ${passive.criticalChancePercent}%, ${passive.criticalDamagePercent}% 증가한다.`;
}

/** 스킬별 피해 회복은 최대 체력 회복과 다른 계약이므로 실제 피해 기준임을 명시한다. */
export function damageHealingLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `실제 피해의 ${percent}% 회복`;
}
