import { TRADE_PACKAGES } from "./tradePackages";
import { MILEAGE_PRODUCTS } from "./mileageShop";
import { DUEL_PRODUCTS } from "./duelShop";

/** 상품이 노출되고 구매될 화면 경계다. ID만으로 다른 화면의 상품을 구매하지 못하게 서버 요청에도 사용한다. */
/**
 * 상품이 서는 자리.
 *
 * **고고학은 제 씬을 만들지 않고 일반 상점의 자리 하나를 빌린다** — 상점은 「위가 무대,
 * 아래가 전시대」라는 규칙이 이미 깊이 박혀 있어, 둘로 갈리면 선반·격자·값줄 규칙이 두 곳이
 * 되고 한쪽만 고치는 사고가 난다.
 */
export type ProductStorefront = "shop" | "trade" | "premium" | "archaeology" | "loot" | "mileage" | "duel";

/** 일반 인게임 상점과 무역소가 공유하는 안정적인 카테고리 계약이다. */
/**
 * 상품이 어느 탭에 서는가. **탭 목록은 자리마다 다르므로 값도 자리마다 다른 뜻을 갖는다.**
 *
 * - 일반 상점은 **무엇으로 사는가**로 가른다(`gold`·`gems`). 한 화면에 두 재화가 섞여 있으면
 *   카드를 하나씩 눌러 봐야 무엇이 드는지 알 수 있고, 탭이 지갑 한 칸을 가리키면 그 줄이
 *   곧 「지금 내가 쓸 수 있는 것」이 된다. 그래서 **두 탭은 서로 다른 품목을 판다** — 같은
 *   것을 두 재화로 살 수 있으면 싼 쪽만 쓰이고 나머지 탭은 열 이유가 없어진다.
 * - 고고학 상점은 값이 원석 하나뿐이라 가를 축이 없다. 대신 **언제 돌아오는 자리인가**로
 *   가른다(`special`·`daily`·`weekly`). 그 값은 이미 상품이 `refresh`로 들고 있으므로
 *   거기서 그대로 나온다 — 두 값이 어긋나면 매주 오는 물건이 「일일」 탭에 서서 매일 들른
 *   손이 허탕을 친다.
 *
 * 두 규칙 모두 `tests/unit/shopCatalog.test.ts`가 자리별로 지킨다.
 */
export type ShopCategory = "gold" | "gems" | "special" | "daily" | "weekly";

/**
 * 전리품 상점의 목록 갈래 — **쓰는 증표**로 가른다.
 *
 * 일반 상점의 `ShopCategory`(일반·강화·룬)를 그대로 쓰면 한 탭 안에 토벌 증표와 인양 기록을
 * 함께 세우게 되어, 눌러 보기 전에는 **무엇으로 사는 자리인지** 알 수 없다. 프리미엄이
 * `PremiumCategory`를 따로 둔 것과 같은 이유다. 탭 하나가 지갑 한 칸을 가리킨다.
 */
export type LootCategory = "raid" | "expedition";

/**
 * 지갑에서 원자 차감할 수 있는 인게임 재화만 가격 재화로 인정한다.
 *
 * 무역이 **패키지 전시장**이 되면서 젬(다이아)과 골드도 이 목록에 든다 — 값은 젬으로 받고
 * 지급에는 골드가 섞이기 때문이다. 셋 다 서버가 같은 지갑 키를 원자 차감·지급하므로 다른
 * 경로를 만들지 않는다.
 */
export type ProductCurrency = "fossil" | "amber" | "cheesecake" | "dnaFragments" | "gems" | "gold" | "rawStone" | "raidSigil" | "salvageRecord" | "duelEmblem";

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
  | { kind: "platform_payment"; platformProductId: string; basePriceKrw: number; /** 할인 전 정가(원화). 있으면 카드가 정가를 긋고 할인율을 단다. */ listPriceKrw?: number }
  | { kind: "free" }
  | { kind: "rewarded_ad"; slotId: string; dailyLimitUtc: number };

/** API 경계에서 확정할 수 있는 상품 지급 항목이다. */
export type ProductGrant =
  | { kind: "currency"; currency: ProductCurrency; amount: number }
  /** `expiresInDays` — 기한이 있는 아이템을 받은 날로부터 며칠 두는가(1~7). 없으면 아이템의 기본 날수. */
  | { kind: "item"; itemId: string; name: string; amount: number; expiresInDays?: number }
  /**
   * 룬 지급. **자리는 사는 쪽이 고르지 않는다** — 정의가 `part`를 적으면 그 칸, 적지 않으면 로테이션 칸이 그 기간에
   * 정한 자리(`rotationRunePart`)가 서버가 내려 주는 `ProductDto.runePart`로 서고 그 자리의 룬이 나온다.
   *
   * - `choose` 없음 — **랜덤 룬**: 등급과 자리는 진열이 정하고 옵션은 서버가 굴린다.
   * - `choose: "main"` — **지정 룬**: 주 옵션 둘을 사는 쪽이 고르고 보조 옵션만 서버가 굴린다.
   *
   * 고른 값은 구매 요청(`runeChoice`)으로 오고 서버가 다시 검증한다 — 화면의 선택을 믿지 않는다.
   */
  | { kind: "rune"; name: string; amount: number; rarity: "uncommon" | "rare" | "epic" | "legendary"; part?: 0 | 1 | 2; choose?: "main" }
  | { kind: "profile_decoration"; decorationId: string; name: string }
  /** 한 개체의 파편. 정의에는 `relicId`가 없고 서버가 `weeklySsrFragment`를 그 주의 개체로 풀어 내려 준다. */
  | { kind: "relic_fragment"; relicId: string; amount: number }
  /** 마일리지 상점의 「이번 주 SSR 파편」 자리표시. 구매 순간의 주 개체(`mileageWeeklyClerkId`)로 확정된다. */
  | { kind: "weekly_ssr_fragment"; amount: number }
  /** 마일리지 상점의 「주간 SR / 일간 R 파편」 자리표시. 구매 순간의 기간(`mileageFragmentRelicId`)으로 개체가 확정된다. */
  | { kind: "rotating_fragment"; rarity: "SR" | "R"; period: "weekly" | "daily"; amount: number };

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
  | "shop-product-gems" | "shop-product-amber" | "shop-product-fossil"
  | "shop-product-ancient-core" | "shop-product-refined-core" | "shop-product-restoration-crystal";

/**
 * 프리미엄 화면의 목록 갈래.
 *
 * 일반 상점의 `ShopCategory`(일반·강화·룬)를 그대로 쓰던 때는 후원 패스가 「룬」 탭에 서 있었다 —
 * 재화로 사는 보급품을 가르는 기준이라 현금 상품에는 아무 뜻이 없었다. 여기는 **무엇을 사는가**로
 * 가른다: 묶음(패키지), 지금만 싼 것(특가), 기간·수량이 걸린 것(한정), 그리고 다이아 자체(젬).
 */
export type PremiumCategory = "package" | "pass" | "deal" | "limited" | "gem";

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
  /** 전리품 상점의 목록 갈래. 그 storefront의 상품만 채운다. */
  lootCategory?: LootCategory;
  /** 프리미엄 화면의 목록 갈래. 다른 storefront의 상품은 읽지 않는다. */
  premiumCategory?: PremiumCategory;
  name: string; description: string;
  acquisition: ProductAcquisition;
  grants: readonly ProductGrant[];
  /** 구매 작업판이 처음 제안할 묶음 수량이며 서버는 요청 수량을 별도로 검증한다. */
  defaultQuantity: number;
  passBenefit?: PassBenefitDefinition;
  /**
   * 계정에서 **처음 사는 순간에만** 얹는 보너스 지급(프리미엄 다이아).
   *
   * 값 하나로 "두 배"를 적지 않고 지급 목록으로 적는다 — 보너스가 다이아가 아닌 것이어도 같은 경계를 지난다.
   * 첫 구매 여부는 구매 기록(`productPurchases`)에서 서버가 판정하므로 영구 제한(`refresh: "none"`·`"once"`)
   * 상품에만 단다.
   */
  firstPurchaseBonus?: readonly ProductGrant[];
  purchaseLimit: number; refresh: ProductRefresh; visibleFrom: string; visibleUntil: string;
  /**
   * 로테이션 칸(`src/data/runeRotation.ts`)의 ID. 있으면 그 칸이 **이 기간에 이 상품을 고른 때만** 진열된다.
   * 같은 칸을 가리키는 상품끼리는 한 기간에 하나만 선다.
   */
  rotationSlot?: string;
}

/** 프로토타입 운영 카탈로그. 실제 차감과 지급은 이 데이터가 아니라 GameApi만 수행한다. */
export const SHOP_PRODUCTS: readonly ProductDefinition[] = [
  // 일반 탭은 세로 목록 조작을 실제 콘텐츠로 확인할 수 있도록 용도와 가격대가 다른 보급 묶음을 함께 둔다.
  { id: "shop-field-supplies", storefront: "shop", category: "daily", iconKey: "shop-product-supplies", name: "치즈케이크 (소)", description: "", acquisition: { kind: "currency", currency: "gold", amount: 10000 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 40 }], defaultQuantity: 1, purchaseLimit: 5, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-field-rations", storefront: "shop", category: "daily", iconKey: "shop-product-supplies", name: "치즈케이크 (중)", description: "", acquisition: { kind: "currency", currency: "gold", amount: 19000 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 80 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-recovery-cache", storefront: "shop", category: "special", iconKey: "shop-product-supplies", name: "치즈케이크 (대)", description: "", acquisition: { kind: "currency", currency: "gold", amount: 28000 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 120 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-survey-crate", storefront: "shop", category: "special", iconKey: "shop-product-supplies", name: "치즈케이크 (특대)", description: "", acquisition: { kind: "currency", currency: "gold", amount: 32000 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 200 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-night-kit", storefront: "shop", category: "special", iconKey: "shop-product-supplies", name: "치즈케이크 (긴급)", description: "", acquisition: { kind: "currency", currency: "gold", amount: 20000 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 100 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **골드 탭은 젬으로 골드를 바꾸는 교환소다.** 골드는 현상수배에서 스테미나로 벌 수 있으므로 값은 시세(젬 1 = 골드 500)보다 **밑**에 둔다 — 급할 때의 편의이지 이득이 아니다.
  // 그래서 가치 %는 100을 넘지 않고 진열대는 배지를 세우지 않는다. 많이 낼수록 조금 유리하다(80 → 92%).
  { id: "shop-gold-small", storefront: "shop", category: "gold", iconKey: "shop-product-supplies", name: "골드 (소)", description: "", acquisition: { kind: "currency", currency: "gems", amount: 60 }, grants: [{ kind: "currency", currency: "gold", amount: 24000 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-gold-medium", storefront: "shop", category: "gold", iconKey: "shop-product-supplies", name: "골드 (중)", description: "", acquisition: { kind: "currency", currency: "gems", amount: 300 }, grants: [{ kind: "currency", currency: "gold", amount: 126000 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-gold-large", storefront: "shop", category: "gold", iconKey: "shop-product-supplies", name: "골드 (대)", description: "", acquisition: { kind: "currency", currency: "gems", amount: 600 }, grants: [{ kind: "currency", currency: "gold", amount: 264000 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-gold-xlarge", storefront: "shop", category: "gold", iconKey: "shop-product-supplies", name: "골드 (특대)", description: "", acquisition: { kind: "currency", currency: "gems", amount: 1200 }, grants: [{ kind: "currency", currency: "gold", amount: 552000 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  /*
   * **일반 상점의 탭은 일일 · 특가 · 골드 셋이다.** 일일은 매일 돌아오는 소량, 특가는 주간·월간으로 한두 개씩 얹히는 이득
   * 상품(가치 %가 진열대에 선다), 골드는 젬으로 골드를 바꾸는 교환소다. **젬으로는 음료를 거의 팔지 않는다** — 젬으로
   * 스테미나를 채우는 길(`staminaRecharge`)이 이미 있어, 일일·특가에 한 개씩 충전보다 싸게만 둔다(기본 24 · + 45).
   *
   * 치즈케이크는 크기로 이름을 정형화한다 — (소) 40 · (중) 80 · (대) 120 · (특대) 200 · (긴급) 100. 값은 골드 250/개(무역 시세
   * 젬 1 = 치즈케이크 2 = 골드 500)에서 일일은 100~105%, 특가는 107~156%다.
   */
  { id: "shop-tonic-pack", storefront: "shop", category: "daily", iconKey: "shop-product-supplies", name: "에너지 드링크", description: "", acquisition: { kind: "currency", currency: "gems", amount: 45 }, grants: [{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1, expiresInDays: 7 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "shop-tonic-large-pack", storefront: "shop", category: "special", iconKey: "shop-product-supplies", name: "에너지 드링크+", description: "", acquisition: { kind: "currency", currency: "gems", amount: 45 }, grants: [{ kind: "item", itemId: "stamina-tonic-large", name: "에너지 드링크+", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **고고학 상점.** 기본 리롤은 언제나 플레이 재화(원석)로 돌아가야 하므로, 여기서 파는 것은
  // 그 바깥의 몫이다 — 원석 자체는 골드로 바꿔 주되 하루 몫으로 끊고, 특성 아이템은 상시
  // 무제한으로 팔지 않는다(무한 과금으로 전설 특성을 완성하는 길을 열지 않는다).
  // 매일 돌아오는 자리 하나는 있어야 「오늘 들러 볼 이유」가 생긴다. 룬 가루는 공용 성장
  // 재료라 인양 상점과 겹쳐도 된다 — 한쪽에만 두면 그 콘텐츠를 돌지 않는 사람의 성장이 막힌다.
  // **원석으로 사는 재화.** 원석 한 알은 골드 150쯤이 시세라, 값은 시세보다 조금 비싸게 두어 「원석을 캐서 재화로 바꾸는
  // 길」은 열되 그것이 가장 좋은 환전이 되지 않게 한다. 화석·호박석은 연구 한 번(젬 300)이 기준이고 두 연구의 확률·회색 보상이 같으므로 값도 같다(2,500). 주간 한 개씩만 연다.
  { id: "arch-gold-exchange", storefront: "archaeology", category: "daily", iconKey: "shop-product-supplies", name: "골드", description: "", acquisition: { kind: "currency", currency: "rawStone", amount: 250 }, grants: [{ kind: "currency", currency: "gold", amount: 30000 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-cheesecake-exchange", storefront: "archaeology", category: "daily", iconKey: "shop-product-supplies", name: "치즈케이크", description: "", acquisition: { kind: "currency", currency: "rawStone", amount: 150 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 60 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-fossil-exchange", storefront: "archaeology", category: "weekly", iconKey: "shop-product-supplies", name: "화석", description: "", acquisition: { kind: "currency", currency: "rawStone", amount: 2500 }, grants: [{ kind: "currency", currency: "fossil", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-amber-exchange", storefront: "archaeology", category: "weekly", iconKey: "shop-product-supplies", name: "호박석", description: "", acquisition: { kind: "currency", currency: "rawStone", amount: 2500 }, grants: [{ kind: "currency", currency: "amber", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-ancient-core", storefront: "archaeology", category: "weekly", iconKey: "shop-product-ancient-core", name: "미지의 고대 핵", description: "미지의 고대 핵 1개", acquisition: { kind: "currency", currency: "rawStone", amount: 600 }, grants: [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 3, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-refined-core", storefront: "archaeology", category: "special", iconKey: "shop-product-refined-core", name: "정제된 고대 핵", description: "정제된 고대 핵 1개", acquisition: { kind: "currency", currency: "rawStone", amount: 1500 }, grants: [{ kind: "item", itemId: "refined-core", name: "정제된 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "arch-restoration-crystal", storefront: "archaeology", category: "special", iconKey: "shop-product-restoration-crystal", name: "완전 복원 결정", description: "완전 복원 결정 1개", acquisition: { kind: "currency", currency: "rawStone", amount: 4500 }, grants: [{ kind: "item", itemId: "restoration-crystal", name: "완전 복원 결정", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **레이드 상점.** 값은 전부 토벌 증표라 레이드를 돈 사람만 살 수 있고, 다른 재화로 사는 길을
  // 두지 않는다 — 젬으로도 살 수 있으면 증표가 무엇을 위한 것인지 말하지 못한다. 제한은 주간이
  // 기본이고, 성장 재료만 매일 열어 꾸준히 도는 사람이 매주 몰아 사지 않게 한다.
  { id: "raid-cheesecake-ration", storefront: "loot", lootCategory: "raid", category: "daily", iconKey: "shop-product-supplies", name: "토벌 보급 급여", description: "치즈케이크 100개", acquisition: { kind: "currency", currency: "raidSigil", amount: 90 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 100 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-gold-bounty", storefront: "loot", lootCategory: "raid", category: "daily", iconKey: "shop-product-fossil", name: "토벌 포상금", description: "골드 20,000개", acquisition: { kind: "currency", currency: "raidSigil", amount: 70 }, grants: [{ kind: "currency", currency: "gold", amount: 20000 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-ancient-core", storefront: "loot", lootCategory: "raid", category: "weekly", iconKey: "shop-product-ancient-core", name: "미지의 고대 핵", description: "미지의 고대 핵 1개", acquisition: { kind: "currency", currency: "raidSigil", amount: 120 }, grants: [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "raid-refined-core", storefront: "loot", lootCategory: "raid", category: "special", iconKey: "shop-product-refined-core", name: "정제된 고대 핵", description: "정제된 고대 핵 1개", acquisition: { kind: "currency", currency: "raidSigil", amount: 300 }, grants: [{ kind: "item", itemId: "refined-core", name: "정제된 고대 핵", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **인양 탭.** 값은 전부 인양 기록이라 원정을 돈 사람만 살 수 있다.
  //
  // **레이드 탭과 품목이 겹치지 않는다** — 같은 것을 두 증표로 살 수 있으면 둘 중 싼 쪽만
  // 쓰이고 나머지 탭은 열 이유가 없어진다. 그래서 레이드는 **성장 재료**(치즈케이크·골드·
  // 화석·호박석)와 고대 핵을 맡고, 인양은 **수장된 지부에서 건져 올린 것**(원석·룬 가루·
  // 복원 결정)과 보급품을 맡는다.
  { id: "loot-salvage-orestone", storefront: "loot", lootCategory: "expedition", category: "daily", iconKey: "shop-product-fossil", name: "인양 광물 회수분", description: "원석 300개", acquisition: { kind: "currency", currency: "salvageRecord", amount: 100 }, grants: [{ kind: "currency", currency: "rawStone", amount: 300 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "loot-salvage-tonic", storefront: "loot", lootCategory: "expedition", category: "daily", iconKey: "shop-product-supplies", name: "인양 보급 음료", description: "에너지 드링크 1개", acquisition: { kind: "currency", currency: "salvageRecord", amount: 85 }, grants: [{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1, expiresInDays: 7 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "loot-salvage-gems", storefront: "loot", lootCategory: "expedition", category: "weekly", iconKey: "shop-product-gems", name: "인양 정산 결정", description: "다이아 40개", acquisition: { kind: "currency", currency: "salvageRecord", amount: 75 }, grants: [{ kind: "currency", currency: "gems", amount: 40 }], defaultQuantity: 1, purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "loot-salvage-crystal", storefront: "loot", lootCategory: "expedition", category: "special", iconKey: "shop-product-restoration-crystal", name: "완전 복원 결정", description: "완전 복원 결정 1개", acquisition: { kind: "currency", currency: "salvageRecord", amount: 340 }, grants: [{ kind: "item", itemId: "restoration-crystal", name: "완전 복원 결정", amount: 1 }], defaultQuantity: 1, purchaseLimit: 1, refresh: "monthly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // **룬 칸 — 가끔만 나온다.** 주 무대는 고고학이고 다른 상점은 드물게, 조금 더 비싸게 판다.
  // 어느 기간에 어느 칸이 열리는지는 로테이션 순수 함수(`rotationOffer`)가 정하며, 값은 전부 고고학
  // 900(희귀)·3,000(영웅)원석을 기준으로 환산했다. 젬(다이아)으로는 팔지 않고 전설은 팔지 않는다.
  { id: "arch-rune-daily-uncommon", storefront: "archaeology", category: "daily", iconKey: "shop-product-rune", name: "고급 룬", description: "옵션 무작위", acquisition: { kind: "currency", currency: "rawStone", amount: 300 }, grants: [{ kind: "rune", name: "고급 룬", amount: 1, rarity: "uncommon" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "arch-daily" },
  { id: "arch-rune-daily-rare", storefront: "archaeology", category: "daily", iconKey: "shop-product-rune", name: "희귀 룬", description: "옵션 무작위", acquisition: { kind: "currency", currency: "rawStone", amount: 900 }, grants: [{ kind: "rune", name: "희귀 룬", amount: 1, rarity: "rare" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "arch-daily" },
  { id: "arch-rune-weekly-epic", storefront: "archaeology", category: "weekly", iconKey: "shop-product-rune", name: "영웅 룬", description: "옵션 무작위", acquisition: { kind: "currency", currency: "rawStone", amount: 3000 }, grants: [{ kind: "rune", name: "영웅 룬", amount: 1, rarity: "epic" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "arch-weekly-a" },
  { id: "arch-rune-pick-rare", storefront: "archaeology", category: "weekly", iconKey: "shop-product-rune", name: "지정 희귀 룬", description: "주 옵션 선택 · 보조 옵션 무작위", acquisition: { kind: "currency", currency: "rawStone", amount: 2400 }, grants: [{ kind: "rune", name: "희귀 룬", amount: 1, rarity: "rare", choose: "main" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "arch-weekly-a" },
  { id: "arch-rune-pick-epic", storefront: "archaeology", category: "weekly", iconKey: "shop-product-rune", name: "지정 영웅 룬", description: "주 옵션 선택 · 보조 옵션 무작위", acquisition: { kind: "currency", currency: "rawStone", amount: 7500 }, grants: [{ kind: "rune", name: "영웅 룬", amount: 1, rarity: "epic", choose: "main" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "arch-weekly-b" },
  { id: "shop-rune-weekly", storefront: "shop", category: "special", iconKey: "shop-product-rune", name: "희귀 룬", description: "옵션 무작위", acquisition: { kind: "currency", currency: "gold", amount: 135000 }, grants: [{ kind: "rune", name: "희귀 룬", amount: 1, rarity: "rare" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "shop-weekly" },
  { id: "raid-rune-weekly", storefront: "loot", lootCategory: "raid", category: "weekly", iconKey: "shop-product-rune", name: "영웅 룬", description: "옵션 무작위", acquisition: { kind: "currency", currency: "raidSigil", amount: 550 }, grants: [{ kind: "rune", name: "영웅 룬", amount: 1, rarity: "epic" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "raid-weekly" },
  { id: "loot-rune-weekly", storefront: "loot", lootCategory: "expedition", category: "weekly", iconKey: "shop-product-rune", name: "희귀 룬", description: "옵션 무작위", acquisition: { kind: "currency", currency: "salvageRecord", amount: 220 }, grants: [{ kind: "rune", name: "희귀 룬", amount: 1, rarity: "rare" }], defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z", rotationSlot: "loot-weekly" },
  // **무역은 교환소가 아니라 패키지 전시장이다.** 일반 상점이 화석·호박석으로 보급품을 사는
  // 상시 진열대라면, 무역은 그때그때 운영이 올려 두는 **묶음 하나하나를 전시**하는 자리다 —
  // 값은 젬으로 받고, 같은 젬으로 따로 사는 것보다 더 많이 주는 것이 이 화면의 존재 이유다.
  // 얼마나 더 주는지(가치 %)는 화면이 적지 않고 `tradePackages.ts`의 시세표가 환산한다.
  // 프리미엄(플랫폼 결제)은 여기 오지 않는다 — 유료 묶음은 `premium` storefront가 맡는다.
  ...TRADE_PACKAGES,
  // **마일리지 상점.** 뽑기에서 모이는 DNA 마일리지로 사는 자리다 — 주간·일간 구역은 `category`가 가른다.
  ...MILEAGE_PRODUCTS,
  // **결투 상점.** 결투장에서 모은 투사의 휘장으로만 사는 자리다 — 일일·주간·특가는 `category`가 가른다.
  ...DUEL_PRODUCTS,
];

/** products 모듈을 직접 소비하는 화면은 storefront로 걸러 쓴다. */
export const PRODUCTS = SHOP_PRODUCTS;
