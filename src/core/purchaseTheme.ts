import type { PremiumCategory, ProductGrant } from "../data/products";

/**
 * 현금 결제 팝업의 테마. 팝업 틀은 하나이고 배경색·장식·조명 값만 이 다섯이 갈린다.
 *
 * 상품마다 팝업을 따로 꾸미면 상품이 늘 때마다 그림이 늘고, 전환에 보탬이 되는 것은 장식이 아니라
 * "상품과 가격만 크게 보이는 것"이라 테마는 **분위기만** 말한다. 어느 상품이 어느 테마인지는 표가 아니라
 * 지급 목록에서 나오는 규칙이다 — 상품이 늘어도 이 파일은 그대로다.
 */
export const PURCHASE_THEME_IDS = ["archaeology", "gacha", "currency", "pass", "basic"] as const;
export type PurchaseThemeId = (typeof PURCHASE_THEME_IDS)[number];

/** 규칙이 맞지 않는 상품만 예외로 적는다(상품 ID → 테마). */
export const PURCHASE_THEME_OVERRIDES: Readonly<Record<string, PurchaseThemeId>> = {
  "premium-raid-bundle": "basic",
};

export interface PurchaseThemeInput {
  id?: string;
  premiumCategory?: PremiumCategory;
  grants: readonly ProductGrant[];
}

const ARCHAEOLOGY_ITEMS: ReadonlySet<string> = new Set(["strata-ticket"]);

/** 발굴권·원석 → 고고학, 화석·호박석(합 2 이상) → 뽑기, 젬·골드 → 재화, 패스·구독 → 패스, 그 밖 → 기본. */
export function purchaseThemeOf(product: PurchaseThemeInput): PurchaseThemeId {
  if (product.id !== undefined && PURCHASE_THEME_OVERRIDES[product.id]) return PURCHASE_THEME_OVERRIDES[product.id];
  if (product.premiumCategory === "pass" || product.premiumCategory === "subscription") return "pass";
  let digs = false; let research = 0; let money = false;
  for (const grant of product.grants) {
    if (grant.kind === "item" && ARCHAEOLOGY_ITEMS.has(grant.itemId)) digs = true;
    if (grant.kind !== "currency") continue;
    if (grant.currency === "rawStone") digs = true;
    else if (grant.currency === "fossil" || grant.currency === "amber") research += grant.amount;
    else if (grant.currency === "gems" || grant.currency === "gold") money = true;
  }
  if (digs) return "archaeology";
  if (research >= 2) return "gacha";
  if (money) return "currency";
  return "basic";
}
