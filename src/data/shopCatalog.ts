import { SHOP_PRODUCTS } from "./products";
import { registerDataText } from "../i18n";
import type { ProductDefinition, ProductStorefront, ShopCategory, ShopProductIconKey } from "./products";

/** 기존 import 경로를 유지하면서 상품 계약의 단일 소유자인 products를 공개한다. */
export type { PassBenefitDefinition, ProductAcquisition, ProductCurrency, ProductDefinition, ProductGrant, ProductRefresh, ProductStorefront, ShopCategory, ShopProductIconKey } from "./products";

/** 탭 문구와 순서를 화면 밖에서 관리한다. */
export const SHOP_TABS: ReadonlyArray<{ id: ShopCategory; label: string }> = [
  { id: "general", label: "일반" }, { id: "enhancement", label: "강화" }, { id: "rune", label: "룬" },
];

/** 임시 상품 그림 등록표이며 최종 원화가 준비되면 경로만 교체한다. */
export const SHOP_PRODUCT_ICON_ASSETS: ReadonlyArray<readonly [ShopProductIconKey, string]> = [
  ["shop-product-supplies", "/sprites/currency/cake.webp"],
  ["shop-product-enhancement", "/sprites/currency/dna.webp"],
  ["shop-product-rune", "/sprites/runes/rare-1.webp"],
];

const LEGACY_PRODUCTS: readonly ProductDefinition[] = [
  // 이벤트도 같은 카탈로그 가격·지급·구매 제한 규칙을 사용하며 기간 판정은 서버 API가 수행한다.
  { id: "event-great-auk-supplies", storefront: "trade", category: "general", iconKey: "shop-product-supplies", name: "해안 조사 보급품", description: "큰바다쇠오리 발굴 보고서 교환 보급", acquisition: { kind: "currency", currency: "cheesecake", amount: 30 }, grants: [{ kind: "currency", currency: "fossil", amount: 120 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: "2026-08-20T00:00:00Z", visibleUntil: "2026-09-03T00:00:00Z" },
  // 예전 재화 교환 줄(`trade-weeds`·`trade-dna`·`trade-rune-kit`)은 지웠다 — 무역이 패키지
  // 전시장이 되면서 같은 화면에 교환소와 전시대가 함께 서면 무엇을 보는 자리인지 흐려진다.
  // 재화를 재화로 바꾸는 일은 교류의 교환소와 DNA 교환이 그대로 맡는다.
  { id: "premium-starter", storefront: "premium", category: "general", iconKey: "shop-product-supplies", name: "신입 연구원 패키지", description: "호박석 20개 · 플랫폼 결제 준비 중", acquisition: { kind: "platform_payment", platformProductId: "premium-starter", displayPrice: "₩4,900" }, grants: [{ kind: "currency", currency: "amber", amount: 20 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // 후원 패스는 광고를 제거하지 않고, 기존 광고 슬롯을 같은 보상·한도의 즉시 수령 슬롯으로 바꾼다.
  { id: "premium-monthly", storefront: "premium", category: "enhancement", iconKey: "shop-product-enhancement", name: "월간 연구 후원", description: "30일간 광고 보상 즉시 수령 · 슬롯별 기존 일일 한도 · 매일 다이아 5개 · 즉시 화석 4,000개 · 월간 후원자 명찰", acquisition: { kind: "platform_payment", platformProductId: "premium-monthly", displayPrice: "₩14,900" }, grants: [{ kind: "currency", currency: "fossil", amount: 4000 }, { kind: "profile_decoration", decorationId: "patron-monthly", name: "월간 후원자 명찰" }], passBenefit: { durationDays: 30, instantAdRewards: true, usesStandardAdRewardPolicy: true, dailyBonus: { currency: "gems", amount: 5 } }, defaultQuantity: 1, purchaseLimit: 1, refresh: "none", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // 영구 권리는 장기 지급 부채를 가격에 반영하며, 실제 판매 전 운영 수명과 원가를 다시 검토해야 한다.
  { id: "premium-lifetime", storefront: "premium", category: "rune", iconKey: "shop-product-rune", name: "영구 연구 후원자", description: "영구 광고 보상 즉시 수령 · 슬롯별 기존 일일 한도 · 매일 다이아 5개 · 즉시 화석 12,000개 · 영구 후원자 홀로그램", acquisition: { kind: "platform_payment", platformProductId: "premium-lifetime", displayPrice: "₩119,000" }, grants: [{ kind: "currency", currency: "fossil", amount: 12000 }, { kind: "profile_decoration", decorationId: "patron-lifetime", name: "영구 후원자 홀로그램" }], passBenefit: { durationDays: null, instantAdRewards: true, usesStandardAdRewardPolicy: true, dailyBonus: { currency: "gems", amount: 5 } }, defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
];

/** 모든 storefront를 한 카탈로그로 합치되 각 소비자는 명시적으로 경계를 고른다. */
export const PRODUCTS: readonly ProductDefinition[] = [...SHOP_PRODUCTS, ...LEGACY_PRODUCTS];

/** 화면 모델과 서버 검증이 공유하는 명시적 storefront 목록이다. */
export const PRODUCT_STOREFRONTS: readonly ProductStorefront[] = ["shop", "trade", "premium"];

/** 상점 탭 이름을 언어별로 덮어쓸 수 있게 등록한다. */
for (const tab of SHOP_TABS) registerDataText(tab, "label", `shop.tab.${tab.id}`);
/** 상품 이름과 설명도 함께 등록한다. */
for (const product of PRODUCTS) {
  registerDataText(product, "name", `product.${product.id}.name`);
  registerDataText(product, "description", `product.${product.id}.description`);
}

/** 프로필 장식처럼 지급품 자체가 이름을 가진 것도 화면에 서므로 등록한다. */
for (const product of PRODUCTS) {
  product.grants?.forEach((grant, index) => registerDataText(grant, "name", `product.${product.id}.grant.${index}`));
}
