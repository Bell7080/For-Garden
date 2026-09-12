import { TRADE_PACKAGES } from "./tradePackages";

/** 상품이 노출되고 구매될 화면 경계다. ID만으로 다른 화면의 상품을 구매하지 못하게 서버 요청에도 사용한다. */
export type ProductStorefront = "shop" | "trade" | "premium";

/** 일반 인게임 상점과 무역소가 공유하는 안정적인 카테고리 계약이다. */
export type ShopCategory = "general" | "enhancement" | "rune";

/**
 * 지갑에서 원자 차감할 수 있는 인게임 재화만 가격 재화로 인정한다.
 *
 * 무역이 **패키지 전시장**이 되면서 젬(다이아)과 골드도 이 목록에 든다 — 값은 젬으로 받고
 * 지급에는 골드가 섞이기 때문이다. 셋 다 서버가 같은 지갑 키를 원자 차감·지급하므로 다른
 * 경로를 만들지 않는다.
 */
export type ProductCurrency = "fossil" | "amber" | "cheesecake" | "dnaFragments" | "gems" | "gold";

/** 가격 숫자와 획득 절차를 분리한 판별 합집합이며 외부 절차의 필수 식별자를 타입으로 강제한다. */
export type ProductAcquisition =
  | { kind: "currency"; currency: ProductCurrency; amount: number }
  | { kind: "platform_payment"; platformProductId: string; displayPrice: string }
  | { kind: "free" }
  | { kind: "rewarded_ad"; slotId: string; dailyLimitUtc: number };

/** API 경계에서 확정할 수 있는 상품 지급 항목이다. */
export type ProductGrant =
  | { kind: "currency"; currency: ProductCurrency; amount: number }
  | { kind: "item"; itemId: string; name: string; amount: number }
  | { kind: "rune"; name: string; amount: number; rarity: "uncommon" | "rare" | "epic" | "legendary"; part: 0 | 1 | 2 }
  | { kind: "profile_decoration"; decorationId: string; name: string };

/** 구매 제한의 재설정 주기다. */
export type ProductRefresh = "none" | "daily" | "weekly" | "once";

/** 상품 그림은 영속 ID와 분리해 최종 원화 교체가 구매 기록에 영향을 주지 않게 한다. */
export type ShopProductIconKey = "shop-product-supplies" | "shop-product-enhancement" | "shop-product-rune";

/** 후원 상품이 부여하는 기간제 또는 영구 계정 권리다. */
export interface PassBenefitDefinition {
  durationDays: number | null;
  instantAdRewards: true;
  usesStandardAdRewardPolicy: true;
  dailyBonus: { currency: "gems"; amount: number };
}

/** 정적 상품은 가격·지급·기본 구매 수량·제한 주기를 빠짐없이 선언한다. */
export interface ProductDefinition {
  id: string; storefront: ProductStorefront; category: ShopCategory; iconKey: ShopProductIconKey;
  name: string; description: string;
  acquisition: ProductAcquisition;
  grants: readonly ProductGrant[];
  /** 구매 작업판이 처음 제안할 묶음 수량이며 서버는 요청 수량을 별도로 검증한다. */
  defaultQuantity: number;
  passBenefit?: PassBenefitDefinition;
  purchaseLimit: number; refresh: ProductRefresh; visibleFrom: string; visibleUntil: string;
}

/** 프로토타입 운영 카탈로그. 실제 차감과 지급은 이 데이터가 아니라 GameApi만 수행한다. */
export const SHOP_PRODUCTS: readonly ProductDefinition[] = [
  // 일반 탭은 세로 목록 조작을 실제 콘텐츠로 확인할 수 있도록 용도와 가격대가 다른 보급 묶음을 함께 둔다.
  { id: "shop-field-supplies", storefront: "shop", category: "general", iconKey: "shop-product-supplies", name: "현장 보급품", description: "현장 활동용 치즈케이크 40개", acquisition: { kind: "currency", currency: "fossil", amount: 100 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 40 }], defaultQuantity: 1, purchaseLimit: 5, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-field-rations", storefront: "shop", category: "general", iconKey: "shop-product-supplies", name: "장기 조사 식량", description: "현장 활동용 치즈케이크 80개", acquisition: { kind: "currency", currency: "fossil", amount: 190 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 80 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-recovery-cache", storefront: "shop", category: "general", iconKey: "shop-product-supplies", name: "긴급 복원 상자", description: "복원용 치즈케이크 120개", acquisition: { kind: "currency", currency: "fossil", amount: 280 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 120 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-survey-crate", storefront: "shop", category: "general", iconKey: "shop-product-supplies", name: "광역 조사 보급함", description: "대규모 조사용 치즈케이크 200개", acquisition: { kind: "currency", currency: "fossil", amount: 450 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 200 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-night-kit", storefront: "shop", category: "general", iconKey: "shop-product-supplies", name: "야간 조사 키트", description: "야간 근무용 치즈케이크 60개", acquisition: { kind: "currency", currency: "fossil", amount: 145 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 60 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-enhancement-dna", storefront: "shop", category: "enhancement", iconKey: "shop-product-enhancement", name: "강화 DNA 묶음", description: "공용 DNA 조각 10개", acquisition: { kind: "currency", currency: "amber", amount: 8 }, grants: [{ kind: "currency", currency: "dnaFragments", amount: 10 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-rune-research", storefront: "shop", category: "rune", iconKey: "shop-product-rune", name: "룬 연구 보급", description: "룬 연구용 DNA 조각 6개", acquisition: { kind: "currency", currency: "fossil", amount: 220 }, grants: [{ kind: "currency", currency: "dnaFragments", amount: 6 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **무역은 교환소가 아니라 패키지 전시장이다.** 일반 상점이 화석·호박석으로 보급품을 사는
  // 상시 진열대라면, 무역은 그때그때 운영이 올려 두는 **묶음 하나하나를 전시**하는 자리다 —
  // 값은 젬으로 받고, 같은 젬으로 따로 사는 것보다 더 많이 주는 것이 이 화면의 존재 이유다.
  // 얼마나 더 주는지(가치 %)는 화면이 적지 않고 `tradePackages.ts`의 시세표가 환산한다.
  // 프리미엄(플랫폼 결제)은 여기 오지 않는다 — 유료 묶음은 `premium` storefront가 맡는다.
  // 교류의 교환소와도 다르다 — 교환소는 파견에서만 나오는 표본을 바꾸는 교류 전용 창구다.
  ...TRADE_PACKAGES,
];

/** products 모듈을 직접 소비하는 화면은 storefront로 걸러 쓴다. */
export const PRODUCTS = SHOP_PRODUCTS;
