/** 상점의 가격 재화. `real_money`는 플랫폼 영수증 검증 전에는 구매할 수 없다. */
export type ProductCurrency = "fossil" | "amber" | "weeds" | "dnaFragments" | "real_money";

/** 지급 항목은 지갑 재화 또는 중복 없는 Heart Gem으로 제한해 서버가 판별 가능하게 한다. */
export type ProductGrant =
  | { kind: "currency"; currency: Exclude<ProductCurrency, "real_money">; amount: number }
  | { kind: "heart_gem"; itemId: string; amount: 1 };

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
  purchaseLimit: number;
  refresh: ProductRefresh;
  visibleFrom: string;
  visibleUntil: string;
}

/** 프로토타입 기간의 상품 구성. 유료 상품은 노출만 하며 FakeServer 구매 경로에서 차단된다. */
export const PRODUCTS: readonly ProductDefinition[] = [
  { id: "trade-weeds", section: "trade", name: "복원용 잡초 묶음", description: "급여에 쓰는 잡초 100개", price: { currency: "fossil", amount: 180 }, grants: [{ kind: "currency", currency: "weeds", amount: 100 }], purchaseLimit: 3, refresh: "daily", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "trade-dna", section: "trade", name: "공용 DNA 조각", description: "돌파 재료 5개", price: { currency: "weeds", amount: 80 }, grants: [{ kind: "currency", currency: "dnaFragments", amount: 5 }], purchaseLimit: 2, refresh: "weekly", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "premium-starter", section: "premium", name: "신입 연구원 패키지", description: "호박석 20개 · 플랫폼 결제 준비 중", price: { currency: "real_money", amount: 4900, display: "₩4,900" }, grants: [{ kind: "currency", currency: "amber", amount: 20 }], purchaseLimit: 1, refresh: "once", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
  { id: "premium-monthly", section: "premium", name: "월간 화석 패스", description: "화석 3,000개 · 플랫폼 결제 준비 중", price: { currency: "real_money", amount: 9900, display: "₩9,900" }, grants: [{ kind: "currency", currency: "fossil", amount: 3000 }], purchaseLimit: 1, refresh: "none", visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z" },
];
