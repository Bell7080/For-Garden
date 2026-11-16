import type { ProductGrant } from "../data/products";
import { PATRON_TIERS, type PatronTierDefinition } from "../data/patronStrata";

/**
 * 후원 지층 창의 「지층 혜택」 카드 목록 — 화면은 이 순수 목록을 읽어 카드만 세운다(Phaser 없음 · `patronStrata.test`).
 *
 * 카드 하나가 혜택 하나다: 매일 보급 한 줄, 그리고 그 지층이 여는 테두리·수식어. 바로 위(얕은) 지층과 견줘
 * 처음 생긴 것은 `new`, 같은 것이 늘어난 것은 `up`이다 — 「한 층 내려가면 무엇이 달라지나」를 카드가 먼저 말한다.
 */
export type PatronBenefitChange = "new" | "up" | "none";

export type PatronBenefitCard =
  | { readonly kind: "daily"; readonly grant: ProductGrant; readonly change: PatronBenefitChange }
  | { readonly kind: "frame"; readonly frameId: string; readonly change: PatronBenefitChange }
  | { readonly kind: "modifier"; readonly modifierId: string; readonly change: PatronBenefitChange };

/** 같은 혜택인지 가르는 열쇠 — 재화는 지갑 칸, 아이템은 그 ID. */
export function grantKey(grant: ProductGrant): string {
  if (grant.kind === "currency") return `currency:${grant.currency}`;
  if (grant.kind === "item") return `item:${grant.itemId}`;
  return `${grant.kind}`;
}

const amountOf = (grant: ProductGrant): number => ("amount" in grant && typeof grant.amount === "number" ? grant.amount : 0);

export function patronBenefitCards(tierIndex: number, tiers: readonly PatronTierDefinition[] = PATRON_TIERS): PatronBenefitCard[] {
  const tier = tiers[tierIndex];
  if (!tier) return [];
  const previous = tierIndex > 0 ? tiers[tierIndex - 1] : undefined;
  const before = new Map((previous?.daily ?? []).map((grant) => [grantKey(grant), amountOf(grant)]));
  const change = (grant: ProductGrant): PatronBenefitChange => {
    if (!previous) return "none";
    const was = before.get(grantKey(grant));
    if (was === undefined) return "new";
    return amountOf(grant) > was ? "up" : "none";
  };
  const cards: PatronBenefitCard[] = tier.daily.map((grant) => ({ kind: "daily", grant, change: change(grant) }));
  if (tier.frameId) cards.push({ kind: "frame", frameId: tier.frameId, change: "new" });
  if (tier.modifierId) cards.push({ kind: "modifier", modifierId: tier.modifierId, change: "new" });
  return cards;
}

/** 모든 지층 중 가장 많은 카드 수 — 창 높이는 이 값으로 굳혀 지층을 넘겨 봐도 판이 출렁이지 않는다. */
export function patronMaxBenefitCards(tiers: readonly PatronTierDefinition[] = PATRON_TIERS): number {
  return tiers.reduce((max, _tier, index) => Math.max(max, patronBenefitCards(index, tiers).length), 0);
}
