import { runeEnhancementAttempts, type RuneInstance, type RunePart, type RuneRarity } from "./runes";

/**
 * 룬 조건별 일괄 판매 — **어느 룬이 팔리는가**는 이 함수 하나가 정한다.
 *
 * 화면은 칩을 고르기만 하고, 미리보기·확인 창·서버로 보내는 ID 목록이 모두 같은 결과를 읽는다 — 셋이 따로
 * 거르면 보여 준 개수와 실제로 사라지는 룬이 갈린다. Phaser를 읽지 않아 테스트가 같은 규칙을 그대로 읽는다.
 *
 * **축마다 고른 칩만 팔린다**(도감 필터와 달리 빈 축은 「전부」가 아니라 「없음」이다). 되돌릴 수 없는 조작이라
 * 칩 하나를 끈 손이 그 축 전체를 판매 대상으로 넓히면 안 된다.
 *
 * **잠근 룬 · 장착 중인 룬 · 즐겨찾기한 룬은 조건과 무관하게 빠진다.** 잠금과 장착은 서버가 판매 자체를
 * 거부하고, 즐겨찾기는 「골라 둔 것」이라 쓸어 파는 손에서 지킨다.
 */

/** 세공 상태 — 아직 안 함 · 세공 중(각인 전) · 각인까지 마침. */
export type RuneCraftState = "fresh" | "crafting" | "engraved";
export const RUNE_CRAFT_STATES: readonly RuneCraftState[] = ["fresh", "crafting", "engraved"];

/** 특성 유무. */
export type RuneTraitPresence = "without" | "with";
export const RUNE_TRAIT_PRESENCE: readonly RuneTraitPresence[] = ["without", "with"];

export interface RuneBulkSellCriteria {
  readonly rarities: readonly RuneRarity[];
  readonly parts: readonly RunePart[];
  readonly craft: readonly RuneCraftState[];
  readonly trait: readonly RuneTraitPresence[];
}

/**
 * 처음 여는 판의 조건 — 세공도 특성도 손대지 않은 고급·희귀 룬. 정리하려고 쌓아 둔 낮은 등급만 고르고,
 * 손을 댄 룬과 영웅·전설은 사람이 직접 켜야 판매 대상이 된다.
 */
export const DEFAULT_RUNE_BULK_SELL_CRITERIA: RuneBulkSellCriteria = {
  rarities: ["uncommon", "rare"],
  parts: [0, 1, 2],
  craft: ["fresh"],
  trait: ["without"],
};

export function runeCraftState(rune: RuneInstance): RuneCraftState {
  if (rune.engravings.length > 0) return "engraved";
  return runeEnhancementAttempts(rune) > 0 ? "crafting" : "fresh";
}

/** 조건과 무관하게 판매에서 빠지는 이유. 없으면 `undefined`. */
export type RuneBulkSellGuard = "equipped" | "locked" | "bookmarked";

export function runeBulkSellGuard(rune: RuneInstance, equipped: boolean): RuneBulkSellGuard | undefined {
  if (equipped) return "equipped";
  if (rune.locked) return "locked";
  if (rune.bookmarked) return "bookmarked";
  return undefined;
}

export function runeMatchesBulkSell(rune: RuneInstance, criteria: RuneBulkSellCriteria): boolean {
  return criteria.rarities.includes(rune.rarity)
    && criteria.parts.includes(rune.part)
    && criteria.craft.includes(runeCraftState(rune))
    && criteria.trait.includes(rune.trait === undefined ? "without" : "with");
}

export interface RuneBulkSellPlan {
  /** 팔릴 룬. 넘겨받은 순서를 지킨다. */
  readonly runes: readonly RuneInstance[];
  /** 조건에는 맞지만 지켜져 빠진 수(장착·잠금·즐겨찾기). 화면이 「N개는 보호되어 빠집니다」로 말한다. */
  readonly protectedCount: number;
  /** 받을 원석 합. 서버가 같은 표(`runeSellValue`)로 다시 셈한다. */
  readonly rawStone: number;
}

export function planRuneBulkSell(
  runes: readonly RuneInstance[],
  criteria: RuneBulkSellCriteria,
  context: { isEquipped: (instanceId: string) => boolean; sellValue: (rune: RuneInstance) => number },
): RuneBulkSellPlan {
  const sold: RuneInstance[] = [];
  let protectedCount = 0;
  for (const rune of runes) {
    if (!runeMatchesBulkSell(rune, criteria)) continue;
    if (runeBulkSellGuard(rune, context.isEquipped(rune.instanceId)) !== undefined) { protectedCount += 1; continue; }
    sold.push(rune);
  }
  return { runes: sold, protectedCount, rawStone: sold.reduce((sum, rune) => sum + context.sellValue(rune), 0) };
}

/** 한 축의 칩을 뒤집는다(켜져 있으면 끄고 꺼져 있으면 켠다). 순서는 표의 순서를 지킨다. */
export function toggleBulkSellValue<T>(values: readonly T[], value: T, order: readonly T[]): T[] {
  const next = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  return order.filter((entry) => next.includes(entry));
}
