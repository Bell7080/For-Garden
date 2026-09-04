import { getExpeditionAugment, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import type { ExpeditionAugmentSelection } from "../core/expeditionRewards";

/**
 * 확정된 증강을 **누구에게 붙었는지**로 갈라 놓는 순수 규칙.
 *
 * 예전에는 확정 증강이 화면 위쪽 한 줄에 이름표로만 늘어섰다. 그래서 "이 캐릭터가 지금 무엇을
 * 받고 있는가"를 알려면 그 줄을 읽고 이름을 대조해야 했다 — 개인 증강이 넷을 넘으면 그마저
 * `+N`에 잠겼다. 전체는 위에, 개인은 그 캐릭터에게 붙여야 눈이 한 번만 움직인다.
 *
 * Phaser를 들여오지 않는 이유는 화면과 팝업이 **같은 순서**를 읽어야 하기 때문이다. 두 곳이
 * 저마다 정렬하면 위에서 본 차례와 목록의 차례가 갈린다.
 */

/** 증강 하나가 화면에 세우는 표식. 액자 안의 문양은 효과 종류가 정한다. */
export type AugmentBadgeGlyph = "attack" | "spell" | "survival" | "shield" | "heal" | "status" | "conditional";

export interface AugmentBadgeView {
  augmentId: string;
  name: string;
  /** 등급·범위 한 줄. */
  meta: string;
  /** 효과 수치 한 줄. */
  effect: string;
  glyph: AugmentBadgeGlyph;
  rarity: ExpeditionAugmentDef["rarity"];
  /** 개인 증강만 갖는 대상. 비어 있으면 전체 증강이다. */
  targetRelicId?: string;
}

/** 선택 화면과 확정 목록이 공유하는 효과 수치 표기다. 운영 데이터의 값을 문구에 다시 적지 않는다. */
export function expeditionAugmentEffectLabel(def: ExpeditionAugmentDef): string {
  const labels = { maxHpPercent: "최대 체력", defensePercent: "방어력", resistancePercent: "저항력", attackPowerPercent: "공격력", spellPowerPercent: "주문력", attackSpeedPercent: "공격 속도", initialShieldPercent: "시작 보호막", statusPotencyPercent: "상태 위력" } as const;
  if (def.effect.kind in labels) return `${labels[def.effect.kind as keyof typeof labels]} +${def.effect.percent}%`;
  if (def.effect.kind === "healAfterBattlePercent") return `전투 후 체력 +${def.effect.percent}%`;
  if (def.effect.kind === "lowHpAttackPowerPercent") return `체력 ${def.effect.belowHpPercent}% 이하\n공격력 +${def.effect.percent}%`;
  if (def.effect.kind === "bleedOnAttack") return `공격 시 출혈 ${def.effect.percent}% · ${def.effect.seconds}초`;
  // 위 분기가 모든 판별 가능한 효과를 다루며, 이 반환은 향후 데이터 종류 추가 시 안전한 표시다.
  return `효과 +${def.effect.percent}%`;
}

/** 등급과 범위를 짧은 인게임 표기로 바꾸되 실제 판정은 정적 데이터의 값을 그대로 사용한다. */
export function expeditionAugmentMetaLabel(def: ExpeditionAugmentDef): string {
  return `${def.rarity === "ssr" ? "SSR" : "SR"} · ${def.target === "party" ? "전체" : "개인"}`;
}

/** 효과 종류가 곧 문양이다. 같은 효과는 어느 증강이든 같은 그림으로 읽힌다. */
export function augmentBadgeGlyph(def: ExpeditionAugmentDef): AugmentBadgeGlyph {
  return def.category === "recovery" ? "heal" : def.category;
}

/** 확정 하나를 표식 하나로 바꾼다. 정의가 사라진 ID는 화면에 세우지 않는다. */
function badgeOf(selection: ExpeditionAugmentSelection): AugmentBadgeView | undefined {
  const def = getExpeditionAugment(selection.augmentId);
  if (!def) return undefined;
  return {
    augmentId: def.id,
    name: def.name,
    meta: expeditionAugmentMetaLabel(def),
    effect: expeditionAugmentEffectLabel(def),
    glyph: augmentBadgeGlyph(def),
    rarity: def.rarity,
    targetRelicId: selection.targetRelicId,
  };
}

/** 전체 증강과 렐릭별 증강. 각 목록의 순서는 **고른 순서** 그대로다. */
export interface AugmentBadgeGroups {
  global: AugmentBadgeView[];
  byRelic: Record<string, AugmentBadgeView[]>;
}

export function expeditionAugmentBadges(selections: readonly ExpeditionAugmentSelection[]): AugmentBadgeGroups {
  const groups: AugmentBadgeGroups = { global: [], byRelic: {} };
  for (const selection of selections) {
    const badge = badgeOf(selection);
    if (!badge) continue;
    if (badge.targetRelicId === undefined) groups.global.push(badge);
    else (groups.byRelic[badge.targetRelicId] ??= []).push(badge);
  }
  return groups;
}

/** 팝업 한 장의 줄 하나. `relicId`가 없으면 전체 적용 줄이다. */
export interface AugmentBadgeRow {
  relicId?: string;
  badges: AugmentBadgeView[];
}

/**
 * 팝업이 그리는 차례 — **전체가 가장 위, 그다음이 편성 순서**다.
 *
 * 고른 순서로 늘어놓으면 같은 캐릭터의 증강이 목록 여기저기에 흩어져, 결국 "이 캐릭터가 무엇을
 * 받고 있나"를 다시 세어야 한다. 아무것도 받지 않은 자리는 줄을 만들지 않는다.
 */
export function expeditionAugmentRows(
  selections: readonly ExpeditionAugmentSelection[],
  relicOrder: readonly string[],
): AugmentBadgeRow[] {
  const groups = expeditionAugmentBadges(selections);
  const rows: AugmentBadgeRow[] = [];
  if (groups.global.length > 0) rows.push({ badges: groups.global });
  for (const relicId of relicOrder) {
    const badges = groups.byRelic[relicId];
    if (badges && badges.length > 0) rows.push({ relicId, badges });
  }
  return rows;
}
