import type { DamagePreview } from "../core/damage";
import type { KeywordDef } from "../data/keywords";
import type { KeywordTextOptions } from "../managers/KeywordManager";
import type { BasicAttack, CombatStatusEffect, FerocityTrait, Passive, Skill, Ultimate } from "../core/types";

/**
 * 순수 회복형 궁극기(메테 등)는 damageType/power가 없어 피해 미리보기를 만들 수 없다.
 *
 * 패시브도 항상 제외한다 — 별도 정형 계산을 쓰지 않고 구조화 필드에서 문장을 만든다.
 * 이 판별 없이 회복형 스킬에 미리보기를 시도하면 damage.ts의 `previewSkillDamage`가
 * 던지는 예외로 정보창 스킬 팝업이 그대로 열리지 않는다(메테 궁극기 팝업 버그).
 */
export function canPreviewSkillDamage(skill: Skill | Passive, kindLabel: string): boolean {
  return kindLabel !== "패시브" && "damageType" in skill && skill.damageType !== undefined;
}

/** 전투 좌표 수치 대신 플레이어가 전장에서 찾을 수 있는 대상 범위를 말한다. */
export function targetingLabel(targeting?: Ultimate["targeting"]): string | undefined {
  if (targeting === "single") return "적 한 명";
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적";
  if (targeting === "battlefieldEnemies") return "전장의 모든 적";
  if (targeting === "targetedCircle") return "지정한 원 안의 모든 적과 생존 아군";
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
export function ferocityTraitDescription(trait: FerocityTrait, stats?: { attack: number; defense: number }): string {
  if (trait.effectId === "attackIntervalReduction") return `공격 간격이 ${trait.reductionPercent}% 짧아진다.`;
  if (trait.effectId === "damageReduction") return `받는 피해가 ${trait.reductionPercent}% 줄어든다.`;
  // 덧셈형 확률도 플레이어에게는 일반적인 퍼센트 기호로 보여 주고 내부 산술 단위는 노출하지 않는다.
  if (trait.effectId === "criticalChanceBonus") return `치명타 확률이 ${trait.chancePercent}% 오른다.`;
  if (trait.effectId === "teamMoveSpeedBonus") return `생존 아군 전체의 이동 속도가 ${trait.bonusPercent}% 빨라진다.`;
  if (trait.effectId === "rexBattleQueen") return `치명타 확률과 모든 피해 흡혈이 각각 ${trait.criticalChancePoints}%, ${trait.allDamageLifeStealPoints}% 증가한다.`;
  if (trait.effectId === "stealthLeap") return `체력 비율이 가장 낮은 적에게 도약해 ${trait.durationSeconds}초 동안 [[stealth|은신]]한다.`;
  if (trait.effectId === "selfAttackSpeedMultiplier") return `공격 속도가 ${trait.bonusPercent}% 증가한다.`;
  if (trait.effectId === "crescendoStaccato") {
    const converted = stats === undefined ? undefined : Math.round(stats.attack * trait.damagePercent / 100);
    const damage = converted === undefined ? `공격력 ${trait.damagePercent}%의` : `[[damage-value|${converted}]]의`;
    return `폭주 중 아군 기본 공격 적중마다 ${damage} 피해량을 가진 [[mette-staccato|스타카토]]가 추가로 발동한다.`;
  }
  if (trait.effectId === "pontusRage") return `폭주 중 매초 모든 적에게 최대 체력 ${trait.maxHpDamagePercentPerSecond}% 고정 피해를 주고, 모든 회복을 취소한다.`;

  // 방어력 계수는 토리카처럼 추가 피해가 있는 범위 타격만 노출하고, 일반 전이 특성은 원래 피해 비율만 보여 준다.
  const speed = trait.attackSpeedBonusPercent === undefined ? "" : `공격 속도가 ${trait.attackSpeedBonusPercent}% 증가한다. `;
  const converted = trait.defenseDamagePercent === undefined || stats === undefined
    ? undefined
    : Math.round(stats.defense * trait.defenseDamagePercent / 100);
  const bonus = trait.defenseDamagePercent === undefined
    ? `원래 피해의 ${trait.damagePercent}%`
    : `${converted === undefined ? "추가" : `[[damage-value|${converted}]]만큼 추가`} 물리 피해`;
  const ending = trait.statusEffect?.kind === "stagger"
    ? `${bonus}를 입히고 [[stagger|경직]]시킨다.`
    : `${bonus}를 입힌다.`;
  return `${speed}기본 공격이 대상 주위의 모든 적에게 적중해 ${ending}`;
}

/** 아다지오의 무게 보호막처럼 패시브가 실제 능력치에서 계산하는 수치를 조회 가능한 태그로 만든다. */
export function passiveShieldKeyword(passive: Passive, atk?: number): KeywordDef | undefined {
  if (passive.kind !== "adagioWeight" || passive.cleanseShieldAttackPercent === undefined || atk === undefined) return undefined;
  const amount = Math.round(atk * passive.cleanseShieldAttackPercent / 100);
  return { id: "shield-value", term: String(amount), kind: "규칙", description: `현재 공격력에서 ${passive.cleanseShieldAttackPercent}%를 받아 계산한 보호막 수치다.` };
}

/** 복합 능력 패시브를 각 구조화 수치에서 문장화해 데이터 변경이 본문에도 즉시 반영되게 한다. */
export function passiveDescription(passive: Passive, atk?: number): string {
  if (passive.kind === "basicHitAttackSpeedStack") return `[[basic-attack|기본 공격]]이 실제 적중할 때마다 이번 전투 동안 [[attack-speed|공격 속도]]가 ${passive.value} 증가한다.`;
  if (passive.kind === "adagioWeight") {
    const shield = passiveShieldKeyword(passive, atk);
    const shieldText = shield === undefined ? `공격력 ${passive.cleanseShieldAttackPercent}%` : `[[shield-value|${shield.term}]]`;
    return `생존 중 아군 [[attack-speed|공격 속도]]를 ${passive.teamAttackSpeedPercent}% 높인다. 아군이 [[crowd-control|군중제어]]에 걸리면 즉시 정화하고 ${shieldText} 보호막을 부여한다.`;
  }
  if (passive.kind === "abyssalPressure") return `완전히 경과한 매초 기본 [[ap|주문력]]의 ${passive.apPercentPerSecond}%가 복리로 누적된다. 현재 체력이 최대 체력의 100%에서 ${passive.maxReductionAtHpPercent}%로 낮아질수록 받는 모든 피해 감소가 ${passive.baseDamageReductionPercent}%에서 ${passive.maxDamageReductionPercent}%까지 선형으로 증가하며, 그 이하에서는 최대치로 제한된다.`;
  if (passive.kind !== "battleMaidMastery") return passive.desc;
  // 네 능력이 모두 같은 비율로 오르므로 값을 한 번만 말한다. 값이 서로 달라지면 다시 나열해야 한다.
  return `전투 시작 시, 공격 속도·공격력·치명타 확률·치명타 피해가 모두 ${passive.attackSpeedPercent}% 오른다.`;
}

/** 아군 전체 회복형 궁극기(도디 등)가 실제 주문력에서 계산하는 회복량을 조회 가능한 태그로 만든다. */
export function allyHealPowerKeyword(percent: number, ap?: number): KeywordDef | undefined {
  if (ap === undefined) return undefined;
  const amount = Math.round(ap * percent / 100);
  return { id: "heal-value", term: String(amount), kind: "규칙", description: `현재 주문력에서 ${percent}%를 받아 계산한 회복 수치다.` };
}

/** 추가 타격 계약을 본문용 키워드 문장으로 바꿔 확률·횟수·회복 수치가 데이터와 함께 바뀌게 한다. */
export function skillDescription(skill: Skill | BasicAttack | Ultimate, ap?: number): string {
  const combo = "combo" in skill ? skill.combo : undefined;
  if (combo) {
    return `공격력의 ${skill.power}% [[physical-damage|물리 피해]]를 준다. ${combo.chancePercent}% 확률로 `
      + `[[combo|연격]]하여 총 ${combo.hitCount}회 적중하고, 매 적중 뒤 [[missing-hp|잃은 체력]]의 `
      + `${combo.missingHpHealingPercentPerHit}%를 회복한다.`;
  }
  // 현재 공격 속도 복합 계수를 가진 궁극기는 스피나의 두 피해 축을 모두 눌러 설명할 수 있게 한다.
  if ("attackSpeedPower" in skill && skill.attackSpeedPower !== undefined) {
    const stun = skill.statusEffects?.find((effect) => effect.kind === "stun");
    return `공격력의 ${skill.power}%와 현재 [[attack-speed|공격 속도]]의 ${skill.attackSpeedPower}%를 합친 `
      + `[[physical-damage|물리 피해]]를 준다${stun ? `고 [[stun|기절]]시킨다` : ""}.`;
  }
  // 범위 피해 위에 아군 전체 회복을 얹는 궁극기(도디)는 피해 수치를 상단 라벨에 맡기고
  // 여기서는 회복량만 실제 주문력에서 계산한 값으로 보여 준다.
  if ("allyHealingPower" in skill && skill.allyHealingPower !== undefined) {
    const heal = allyHealPowerKeyword(skill.allyHealingPower, ap);
    const damageTag = skill.damageType === "physical" ? "[[physical-damage|물리 피해]]" : "[[magical-damage|마법 피해]]";
    const healText = heal === undefined ? `주문력의 ${skill.allyHealingPower}%` : `[[heal-value|${heal.term}]]`;
    return `지정한 넓은 범위의 모든 적에게 ${damageTag}를 주고, 모든 생존 아군의 체력을 ${healText}만큼 회복한다.`;
  }
  return skill.desc;
}

/** 스킬별 피해 회복은 최대 체력 회복과 다른 계약이므로 실제 피해 기준임을 명시한다. */
export function damageHealingLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `실제 피해의 ${percent}% 회복`;
}
