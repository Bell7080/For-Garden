/** 상점의 가격 재화. `real_money`는 플랫폼 영수증 검증 전에는 구매할 수 없다. */
export type ProductCurrency = "fossil" | "amber" | "cheesecake" | "dnaFragments" | "real_money";

/** 즉시 지급품은 재화와 서버 계정에 귀속되는 프로필 장식만 허용한다. */
export type ProductGrant =
  | { kind: "currency"; currency: Exclude<ProductCurrency, "real_money">; amount: number }
  | { kind: "profile_decoration"; decorationId: string; name: string };

/** 단순 묶음과 구분되는 후원 패스의 기간·일일 권리다. null 기간은 영구 권리를 뜻한다. */
export interface PassBenefitDefinition {
  durationDays: number | null;
  instantAdRewards: true;
  /** 광고 이용자와 동일한 슬롯별 기본 보상·UTC 일일 한도를 사용한다. */
  usesStandardAdRewardPolicy: true;
  /** UTC 날짜마다 첫 즉시 수령에 덧붙는 소량의 후원 보너스다. */
  dailyBonus: { currency: "gems"; amount: number };
}

/** 구매 제한의 재설정 주기. `once`는 계정 전체에서 한 번만 허용한다. */
export type ProductRefresh = "none" | "daily" | "weekly" | "once";

/** 운영 데이터만 바꿔 상품을 교체할 수 있는 정적 카탈로그 행이다. 시간은 UTC ISO 문자열이다. */
export interface ProductDefinition {
  id: string;
  section: "trade" | "premium";
  name: string;
  description: string;
  price: { currency: ProductCurrency; amount: number; display?: string };
  grants: readonly ProductGrant[];
  /** 값이 있으면 이 상품은 소모성 재화 묶음이 아니라 계정 권리 상품이다. */
  passBenefit?: PassBenefitDefinition;
  purchaseLimit: number;
  refresh: ProductRefresh;
  visibleFrom: string;
  visibleUntil: string;
}

/** 프로토타입 기간의 상품 구성. 유료 상품은 노출만 하며 FakeServer 구매 경로에서 차단된다. */
export const PRODUCTS: readonly ProductDefinition[] = [
  // 이벤트도 같은 카탈로그 가격·지급·구매 제한 규칙을 사용하며 기간 판정은 서버 API가 수행한다.
  { id: "event-great-auk-supplies", section: "trade", name: "해안 조사 보급품", description: "큰바다쇠오리 발굴 보고서 교환 보급", price: { currency: "cheesecake", amount: 30 }, grants: [{ kind: "currency", currency: "fossil", amount: 120 }], purchaseLimit: 1, refresh: "once", visibleFrom: "2026-08-20T00:00:00Z", visibleUntil: "2026-09-03T00:00:00Z" },
  // 상품 ID는 구매 이력과 서버 요청의 영속 식별자이므로 예전 trade-weeds 값을 호환 ID로 유지한다.
  { id: "trade-weeds", section: "trade", name: "복원용 치즈케이크 묶음", description: "급여에 쓰는 치즈케이크 100개", price: { currency: "fossil", amount: 180 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 100 }], purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "trade-dna", section: "trade", name: "공용 DNA 조각", description: "돌파 재료 5개", price: { currency: "cheesecake", amount: 80 }, grants: [{ kind: "currency", currency: "dnaFragments", amount: 5 }], purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "premium-starter", section: "premium", name: "신입 연구원 패키지", description: "호박석 20개 · 플랫폼 결제 준비 중", price: { currency: "real_money", amount: 4900, display: "₩4,900" }, grants: [{ kind: "currency", currency: "amber", amount: 20 }], purchaseLimit: 1, refresh: "once", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // 후원 패스는 광고를 제거하지 않고, 기존 광고 슬롯을 같은 보상·한도의 즉시 수령 슬롯으로 바꾼다.
  { id: "premium-monthly", section: "premium", name: "월간 연구 후원", description: "30일간 광고 보상 즉시 수령 · 슬롯별 기존 일일 한도 · 매일 다이아 5개 · 즉시 화석 4,000개 · 월간 후원자 명찰", price: { currency: "real_money", amount: 14900, display: "₩14,900" }, grants: [{ kind: "currency", currency: "fossil", amount: 4000 }, { kind: "profile_decoration", decorationId: "patron-monthly", name: "월간 후원자 명찰" }], passBenefit: { durationDays: 30, instantAdRewards: true, usesStandardAdRewardPolicy: true, dailyBonus: { currency: "gems", amount: 5 } }, purchaseLimit: 1, refresh: "none", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  // 영구 권리는 장기 지급 부채를 가격에 반영하며, 실제 판매 전 운영 수명과 원가를 다시 검토해야 한다.
  { id: "premium-lifetime", section: "premium", name: "영구 연구 후원자", description: "영구 광고 보상 즉시 수령 · 슬롯별 기존 일일 한도 · 매일 다이아 5개 · 즉시 화석 12,000개 · 영구 후원자 홀로그램", price: { currency: "real_money", amount: 119000, display: "₩119,000" }, grants: [{ kind: "currency", currency: "fossil", amount: 12000 }, { kind: "profile_decoration", decorationId: "patron-lifetime", name: "영구 후원자 홀로그램" }], passBenefit: { durationDays: null, instantAdRewards: true, usesStandardAdRewardPolicy: true, dailyBonus: { currency: "gems", amount: 5 } }, purchaseLimit: 1, refresh: "once", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
];
