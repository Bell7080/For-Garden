import { SHOP_PRODUCTS } from "./products";
import { PREMIUM_PRODUCTS } from "./premiumProducts";
import { registerDataText } from "../i18n";
import type { PremiumCategory, ProductDefinition, ProductStorefront, ShopProductIconKey } from "./products";

/** 기존 import 경로를 유지하면서 상품 계약의 단일 소유자인 products를 공개한다. */
export type { PassBenefitDefinition, PremiumCategory, ProductAcquisition, ProductCurrency, ProductDefinition, ProductGrant, ProductRefresh, ProductStorefront, ShopCategory, ShopProductIconKey } from "./products";

/**
 * 프리미엄 화면의 목록 교체 줄.
 *
 * 상점·가방과 **같은 서류철 라벨 한 장**(`CategoryTab`)을 쓴다 — 같은 손짓으로 같은 일(보는
 * 목록을 통째로 바꾸기)을 하므로 생김새도 한 곳에서 나온다.
 *
 * **패스는 여기 서지 않는다** — 스토리·레벨·레이드 패스는 로비의 패스 창(`PassPopup`)이 한데 모아 보여 주고,
 * 그 창의 유료 줄에서 연다. 상점에도 세우면 같은 길이 두 곳에서 다른 모양으로 읽힌다.
 */
export const PREMIUM_TABS: ReadonlyArray<{ id: PremiumCategory; label: string }> = [
  { id: "package", label: "패키지" }, { id: "deal", label: "특가" },
  { id: "limited", label: "한정" }, { id: "gem", label: "젬" },
];

/** 임시 상품 그림 등록표이며 최종 원화가 준비되면 경로만 교체한다. */
export const SHOP_PRODUCT_ICON_ASSETS: ReadonlyArray<readonly [ShopProductIconKey, string]> = [
  ["shop-product-supplies", "/sprites/currency/cake.webp"],
  ["shop-product-enhancement", "/sprites/currency/dna.webp"],
  ["shop-product-rune", "/sprites/runes/rare-1.webp"],
  ["shop-product-gems", "/sprites/currency/crystal.webp"],
  ["shop-product-amber", "/sprites/currency/amber.webp"],
  ["shop-product-fossil", "/sprites/currency/fossil.webp"],
  // 룬 특성 재료는 가방의 그 아이템과 같은 그림으로 판다 — 상품 칸만 다른 그림이면 산 것이 가방에서
  // 무엇으로 서는지 알 수 없다.
  ["shop-product-ancient-core", "/sprites/items/ancient-core.webp"],
  ["shop-product-refined-core", "/sprites/items/refined-core.webp"],
  ["shop-product-restoration-crystal", "/sprites/items/restoration-crystal.webp"],
];

const LEGACY_PRODUCTS: readonly ProductDefinition[] = [
  // 이벤트도 같은 카탈로그 가격·지급·구매 제한 규칙을 사용하며 기간 판정은 서버 API가 수행한다.
  { id: "event-great-auk-supplies", storefront: "trade", category: "special", iconKey: "shop-product-supplies", name: "해안 조사 보급품", description: "큰바다쇠오리 발굴 보고서 교환 보급", acquisition: { kind: "currency", currency: "cheesecake", amount: 30 }, grants: [{ kind: "currency", currency: "fossil", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", visibleFrom: "2026-08-20T00:00:00Z", visibleUntil: "2026-09-03T00:00:00Z" },
  // 예전 재화 교환 줄(`trade-weeds`·`trade-dna`·`trade-rune-kit`)은 지웠다 — 무역이 패키지
  // 전시장이 되면서 같은 화면에 교환소와 전시대가 함께 서면 무엇을 보는 자리인지 흐려진다.
  // 재화를 재화로 바꾸는 일은 DNA 교환이 그대로 맡는다.
];

/** 모든 storefront를 한 카탈로그로 합치되 각 소비자는 명시적으로 경계를 고른다. */
export const PRODUCTS: readonly ProductDefinition[] = [...SHOP_PRODUCTS, ...LEGACY_PRODUCTS, ...PREMIUM_PRODUCTS];

/** 화면 모델과 서버 검증이 공유하는 명시적 storefront 목록이다. */
export const PRODUCT_STOREFRONTS: readonly ProductStorefront[] = ["shop", "trade", "premium"];

/** 프리미엄 탭 이름도 같은 방식으로 언어별 덮어쓰기를 받는다. */
for (const tab of PREMIUM_TABS) registerDataText(tab, "label", `premium.tab.${tab.id}`);
/**
 * 상품 이름과 설명도 함께 등록한다.
 *
 * **프리미엄 상품의 설명은 화면에 뜨지 않는다** — 카드와 결제 확인판은 지급 목록(액자 + 수량)과 값만
 * 세우므로, 문장을 따로 두면 지급을 고칠 때 열한 언어의 옛 문장이 조용히 거짓말을 한다. 설명은
 * 한국어 데이터 문서로만 남기고 번역 키는 두지 않는다. 이름은 화면에 서므로 등록한다.
 */
for (const product of PRODUCTS) {
  registerDataText(product, "name", `product.${product.id}.name`);
  if (product.storefront !== "premium") registerDataText(product, "description", `product.${product.id}.description`);
}

/** 프로필 장식처럼 지급품 자체가 이름을 가진 것도 화면에 서므로 등록한다. */
for (const product of PRODUCTS) {
  product.grants?.forEach((grant, index) => registerDataText(grant, "name", `product.${product.id}.grant.${index}`));
}
