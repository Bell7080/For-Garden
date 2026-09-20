import { TRADE_PACKAGES } from "./tradePackages";

/** 상품이 노출되고 구매될 화면 경계다. ID만으로 다른 화면의 상품을 구매하지 못하게 서버 요청에도 사용한다. */
/**
 * 상품이 서는 자리.
 *
 * **고고학은 제 씬을 만들지 않고 일반 상점의 자리 하나를 빌린다** — 상점은 「위가 무대,
 * 아래가 전시대」라는 규칙이 이미 깊이 박혀 있어, 둘로 갈리면 선반·격자·값줄 규칙이 두 곳이
 * 되고 한쪽만 고치는 사고가 난다.
 */
export type ProductStorefront = "shop" | "trade" | "premium" | "archaeology" | "raid";

/** 일반 인게임 상점과 무역소가 공유하는 안정적인 카테고리 계약이다. */
export type ShopCategory = "general" | "enhancement" | "rune";

/**
 * 지갑에서 원자 차감할 수 있는 인게임 재화만 가격 재화로 인정한다.
 *
 * 무역이 **패키지 전시장**이 되면서 젬(다이아)과 골드도 이 목록에 든다 — 값은 젬으로 받고
 * 지급에는 골드가 섞이기 때문이다. 셋 다 서버가 같은 지갑 키를 원자 차감·지급하므로 다른
 * 경로를 만들지 않는다.
 */
export type ProductCurrency = "fossil" | "amber" | "cheesecake" | "dnaFragments" | "gems" | "gold" | "rawStone";

/** 가격 숫자와 획득 절차를 분리한 판별 합집합이며 외부 절차의 필수 식별자를 타입으로 강제한다. */
export type ProductAcquisition =
  | { kind: "currency"; currency: ProductCurrency; amount: number }
  /**
   * 아이템으로 값을 치르는 상품.
   *
   * 레이드 상점이 이 갈래를 쓴다 — 토벌 증표는 한 콘텐츠에서만 도는 교환 재료라 지갑 키를
   * 새로 만들지 않고 재료 칸에 산다. 차감은 교류 교환소와 **같은 재고 경계**를 지난다.
   */
  | { kind: "item"; itemId: string; amount: number }
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
/**
 * 구매 제한의 재설정 주기.
 *
 * `monthly`는 고고학의 상위 특성 아이템이 쓴다 — 주간으로 두면 한 달에 넷이 되어, 특성 등급을
 * 상시 과금으로 밀어 올리는 길이 열린다.
 */
export type ProductRefresh = "none" | "daily" | "weekly" | "monthly" | "once";

/** 상품 그림은 영속 ID와 분리해 최종 원화 교체가 구매 기록에 영향을 주지 않게 한다. */
export type ShopProductIconKey =
  | "shop-product-supplies" | "shop-product-enhancement" | "shop-product-rune"
  | "shop-product-gems" | "shop-product-amber" | "shop-product-fossil";

/**
 * 프리미엄 화면의 목록 갈래.
 *
 * 일반 상점의 `ShopCategory`(일반·강화·룬)를 그대로 쓰던 때는 후원 패스가 「룬」 탭에 서 있었다 —
 * 재화로 사는 보급품을 가르는 기준이라 현금 상품에는 아무 뜻이 없었다. 여기는 **무엇을 사는가**로
 * 가른다: 묶음(패키지), 지금만 싼 것(특가), 기간·수량이 걸린 것(한정), 그리고 다이아 자체(젬).
 */
export type PremiumCategory = "package" | "deal" | "limited" | "gem";

/** 후원 상품이 부여하는 기간제 또는 영구 계정 권리다. */
export interface PassBenefitDefinition {
  durationDays: number | null;
  instantAdRewards: true;
  usesStandardAdRewardPolicy: true;
  dailyBonus: { currency: "gems"; amount: number };
  /**
   * 광고를 없애고, 광고 제거 멤버십 전용 조작을 연다(던전 x3 배율).
   *
   * **후원 패스와 다른 축이다.** 후원 패스는 광고를 없애지 않고 광고 슬롯을 같은 보상·한도의
   * 즉시 수령 슬롯으로 바꿀 뿐이고(`instantAdRewards`), 이쪽은 광고 자체를 걷어 낸다. 둘을 한
   * 값으로 묶으면 "즉시 받는 것"과 "안 보는 것"이 같은 말이 되어 상품 설명이 서로를 덮는다.
   */
  adFree?: true;
}

/** 정적 상품은 가격·지급·기본 구매 수량·제한 주기를 빠짐없이 선언한다. */
export interface ProductDefinition {
  id: string; storefront: ProductStorefront; category: ShopCategory; iconKey: ShopProductIconKey;
  /** 프리미엄 화면의 목록 갈래. 다른 storefront의 상품은 읽지 않는다. */
  premiumCategory?: PremiumCategory;
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
  // **고고학 상점.** 기본 리롤은 언제나 플레이 재화(원석)로 돌아가야 하므로, 여기서 파는 것은
  // 그 바깥의 몫이다 — 원석 자체는 골드로 바꿔 주되 하루 몫으로 끊고, 특성 아이템은 상시
  // 무제한으로 팔지 않는다(무한 과금으로 전설 특성을 완성하는 길을 열지 않는다).
  { id: "arch-orestone-cache", storefront: "archaeology", category: "general", iconKey: "shop-product-fossil", name: "원석 정리함", description: "원석 200개", acquisition: { kind: "currency", currency: "gold", amount: 12000 }, grants: [{ kind: "currency", currency: "rawStone", amount: 200 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-orestone-crate", storefront: "archaeology", category: "general", iconKey: "shop-product-fossil", name: "원석 운반 상자", description: "원석 600개", acquisition: { kind: "currency", currency: "fossil", amount: 300 }, grants: [{ kind: "currency", currency: "rawStone", amount: 600 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-ancient-core", storefront: "archaeology", category: "enhancement", iconKey: "shop-product-enhancement", name: "고대 핵 반출 허가", description: "미지의 고대 핵 1개", acquisition: { kind: "currency", currency: "fossil", amount: 600 }, grants: [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-refined-core", storefront: "archaeology", category: "rune", iconKey: "shop-product-rune", name: "정제 핵 반출 허가", description: "정제된 고대 핵 1개", acquisition: { kind: "currency", currency: "amber", amount: 30 }, grants: [{ kind: "item", itemId: "refined-core", name: "정제된 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-restoration-crystal", storefront: "archaeology", category: "rune", iconKey: "shop-product-rune", name: "복원 결정 인가", description: "완전 복원 결정 1개", acquisition: { kind: "currency", currency: "gems", amount: 900 }, grants: [{ kind: "item", itemId: "restoration-crystal", name: "완전 복원 결정", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **레이드 상점.** 값은 전부 토벌 증표라 레이드를 돈 사람만 살 수 있고, 다른 재화로 사는 길을
  // 두지 않는다 — 젬으로도 살 수 있으면 증표가 무엇을 위한 것인지 말하지 못한다. 제한은 주간이
  // 기본이고, 성장 재료만 매일 열어 꾸준히 도는 사람이 매주 몰아 사지 않게 한다.
  { id: "raid-cheesecake-ration", storefront: "raid", category: "general", iconKey: "shop-product-supplies", name: "토벌 보급 급여", description: "치즈케이크 400개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 20 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 400 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-gold-bounty", storefront: "raid", category: "general", iconKey: "shop-product-fossil", name: "토벌 포상금", description: "골드 30,000개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 25 }, grants: [{ kind: "currency", currency: "gold", amount: 30000 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-fossil-crate", storefront: "raid", category: "general", iconKey: "shop-product-fossil", name: "토벌 표본 상자", description: "화석 1,500개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 60 }, grants: [{ kind: "currency", currency: "fossil", amount: 1500 }], defaultQuantity: 2, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-dna-supply", storefront: "raid", category: "enhancement", iconKey: "shop-product-enhancement", name: "토벌 복원 보급", description: "DNA 조각 12개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 80 }, grants: [{ kind: "currency", currency: "dnaFragments", amount: 12 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-amber-token", storefront: "raid", category: "enhancement", iconKey: "shop-product-amber", name: "토벌 공훈 호박석", description: "호박석 15개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 150 }, grants: [{ kind: "currency", currency: "amber", amount: 15 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-ancient-core", storefront: "raid", category: "rune", iconKey: "shop-product-rune", name: "토벌 고대 핵", description: "미지의 고대 핵 1개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 120 }, grants: [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-refined-core", storefront: "raid", category: "rune", iconKey: "shop-product-rune", name: "토벌 정제 핵", description: "정제된 고대 핵 1개", acquisition: { kind: "item", itemId: "raid-sigil", amount: 300 }, grants: [{ kind: "item", itemId: "refined-core", name: "정제된 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **무역은 교환소가 아니라 패키지 전시장이다.** 일반 상점이 화석·호박석으로 보급품을 사는
  // 상시 진열대라면, 무역은 그때그때 운영이 올려 두는 **묶음 하나하나를 전시**하는 자리다 —
  // 값은 젬으로 받고, 같은 젬으로 따로 사는 것보다 더 많이 주는 것이 이 화면의 존재 이유다.
  // 얼마나 더 주는지(가치 %)는 화면이 적지 않고 `tradePackages.ts`의 시세표가 환산한다.
  // 프리미엄(플랫폼 결제)은 여기 오지 않는다 — 유료 묶음은 `premium` storefront가 맡는다.
  ...TRADE_PACKAGES,
];

/** products 모듈을 직접 소비하는 화면은 storefront로 걸러 쓴다. */
export const PRODUCTS = SHOP_PRODUCTS;
