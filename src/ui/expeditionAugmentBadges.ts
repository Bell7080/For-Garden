import { getExpeditionAugment, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import { t } from "../i18n";
import type { ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { BLEED } from "../core/skirmish";

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
  // 능력치 이름은 공용 표에서 읽는다 — 화면마다 다시 적으면 한 곳만 고쳐도 나머지가 옛 이름으로 남는다.
  const labels = { maxHpPercent: "augment.stat.maxHp", defensePercent: "stat.def", resistancePercent: "stat.res", attackPowerPercent: "stat.atk", spellPowerPercent: "stat.ap", attackSpeedPercent: "stat.attackSpeed", initialShieldPercent: "augment.stat.initialShield", statusPotencyPercent: "augment.stat.statusPotency" } as const;
  if (def.effect.kind in labels && "percent" in def.effect) return t("augment.percent", { label: t(labels[def.effect.kind as keyof typeof labels]), percent: def.effect.percent });
  if (def.effect.kind === "healAfterBattlePercent") return t("augment.healAfterBattle", { percent: def.effect.percent });
  if (def.effect.kind === "lowHpAttackPowerPercent") return t("augment.lowHpAttack", { threshold: def.effect.belowHpPercent, percent: def.effect.percent });
  if (def.effect.kind === "bleedOnAttack") {
    // 이름과 수치는 강도별 공용 전투 규칙에서 읽어 데이터와 화면의 복제 상수를 없앤다.
    const bleed = def.effect.strength === "standard" ? BLEED : BLEED.minor;
    const name = t(def.effect.strength === "standard" ? "augment.bleed.standard" : "augment.bleed.minor");
    return t("augment.bleedOnAttack", { everyN: def.effect.everyNAttacks, name, perSecond: bleed.percentPerSecond, seconds: bleed.seconds });
  }
  if (def.effect.kind === "triggered") {
    // 운영 payload의 판별 필드만 읽어 카드 설명을 만들며 실행 함수나 자유 형식 문장을 허용하지 않는다.
    const payload = def.effect.payload;
    if (payload.kind === "shield") return t("augment.shield", { percent: payload.maxHpPercent });
    if (payload.kind === "ultimateCostReduction") return t("augment.ultimateCost", { percent: payload.percent });
    if (payload.kind === "status") return t("augment.statusTrigger", { trigger: t(def.effect.trigger === "onCritical" ? "augment.trigger.critical" : "augment.trigger.hit"), status: payload.status.kind });
    if (payload.kind === "conditionalBonusDamage") return t("augment.conditionalDamage", { status: t(payload.requiresStatus === "curse" ? "augment.status.curse" : "augment.status.stun"), percent: payload.percent });
    if (payload.kind === "lowHpDefense") return t("augment.lowHpDefense", { threshold: payload.belowHpPercent, percent: payload.defensePercent });
    return t("augment.healOnKill", { percent: payload.maxHpPercent });
  }
  // 위 분기가 모든 판별 가능한 효과를 다루며, 이 반환은 향후 데이터 종류 추가 시 안전한 표시다.
  return t("augment.effect");
}

/** 등급과 범위를 짧은 인게임 표기로 바꾸되 실제 판정은 정적 데이터의 값을 그대로 사용한다. */
export function expeditionAugmentMetaLabel(def: ExpeditionAugmentDef): string {
  return t("augment.meta", { rarity: def.rarity === "ssr" ? "SSR" : "SR", target: t(def.target === "party" ? "augment.target.party" : "augment.target.single") });
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
