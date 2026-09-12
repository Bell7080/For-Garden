import type { ProductAcquisition, ProductCurrency, ProductDefinition, ProductGrant, ProductRefresh, ProductStorefront } from "./products";

/**
 * 무역 패키지 — **운영이 그때그때 올려 두는 묶음 하나하나를 전시하는 자리.**
 *
 * 예전의 무역은 재화 교환소였다. 치즈케이크를 내고 DNA 조각을 받는 줄이 일곱 개 늘어서 있어서,
 * 어느 줄이 지금 살 만한지 판단하려면 네 재화의 시세를 머릿속에 갖고 있어야 했다. 게다가 그
 * 일은 교류의 교환소와 DNA 교환이 이미 하고 있었다.
 *
 * 이제 무역은 **패키지 전시장**이다. 한 칸이 묶음 하나이고, 값은 젬으로 받으며, 같은 젬으로
 * 따로 사는 것보다 **더 많이 준다** — 그 "더"가 이 화면의 존재 이유라서 화면에 가치 %로 선다.
 * 프리미엄이 아니므로 플랫폼 결제는 여기 오지 않는다(유료 묶음은 `premium` storefront다).
 *
 * **운영 규칙은 제한과 갱신 주기 둘뿐이다.** 계정당 한 번뿐인 것, 주마다 다시 열리는 것,
 * 날마다 다시 열리는 것. 어느 쪽인지는 화면이 문장을 짓지 않고 이 표의 `refresh`·`purchaseLimit`
 * 에서 나온다(`tradePackageLimitLabel`).
 */

/**
 * 값어치를 재는 **단 하나의 시세표** — 젬 1로 살 수 있는 재화의 양.
 *
 * 패키지마다 "몇 % 가치"를 손으로 적으면, 수치를 조정한 뒤 옛 %가 그대로 남아 화면이 거짓말을
 * 한다. 그래서 %는 데이터에 없고 이 표에서 환산한다. 기준은 이미 서 있는 두 경계다 —
 * 스테미나 충전(젬 30 → 60)과 연구 1회 비용(화석 100 = 호박석 2)이라, 화석 100과 호박석 2가
 * 똑같이 젬 20이 된다. 시세를 고치면 전시 중인 모든 패키지의 %가 함께 움직인다.
 */
export const TRADE_GEM_RATE: Readonly<Record<ProductCurrency, number>> = {
  gems: 1,
  cheesecake: 2,
  fossil: 5,
  gold: 500,
  amber: 0.1,
  dnaFragments: 0.2,
};

/** 지급품 묶음 전체를 젬 값으로 환산한다. 재화가 아닌 지급품은 시세가 없으므로 세지 않는다. */
export function tradeGemValue(grants: readonly ProductGrant[]): number {
  return grants.reduce((sum, grant) => grant.kind === "currency" ? sum + grant.amount / TRADE_GEM_RATE[grant.currency] : sum, 0);
}

/**
 * 낸 값 대비 받는 값의 비율(%). 200이면 "같은 젬으로 따로 사는 것의 두 배".
 *
 * 재화로 값을 받지 않는 상품은 견줄 기준이 없어 `undefined`다 — 그 자리에 100%를 적으면
 * 환산하지 못한 것과 딱 맞는 것이 같은 숫자로 보인다.
 */
export function tradePackageValuePercent(acquisition: ProductAcquisition, grants: readonly ProductGrant[]): number | undefined {
  if (acquisition.kind !== "currency") return undefined;
  const cost = acquisition.amount / TRADE_GEM_RATE[acquisition.currency];
  if (cost <= 0) return undefined;
  return Math.round((tradeGemValue(grants) / cost) * 100);
}

/** 갱신 주기를 말하는 이름표. 같은 말이 카드와 구매 확인에서 갈리지 않게 한 곳에 둔다. */
const REFRESH_LABEL: Readonly<Record<ProductRefresh, string>> = {
  once: "계정당", daily: "매일", weekly: "주간", none: "상시",
};

/**
 * "언제 몇 번까지"와 "지금 몇 번 남았나"를 한 줄로 적는다.
 *
 * 남은 횟수만 적으면 다음에 언제 다시 열리는지 알 수 없고, 주기만 적으면 지금 살 수 있는지
 * 알 수 없다. 둘 다 지금 누를지를 정하는 정보라 함께 선다.
 */
export function tradePackageLimitLabel(refresh: ProductRefresh, purchaseLimit: number, remaining: number): string {
  const period = `${REFRESH_LABEL[refresh]} ${purchaseLimit}회`;
  return remaining > 0 ? `${period} · ${remaining}회 남음` : `${period} · 소진`;
}

/** 무역에 선 상품은 전부 패키지다. 구매 확인판이 수량 작업판과 패키지판을 가르는 기준이다. */
export function isTradePackage(product: { storefront: ProductStorefront }): boolean {
  return product.storefront === "trade";
}

/**
 * 초기 3종.
 *
 * 셋이 서로 다른 운영 주기를 맡는다 — **주간 3회**(꾸준히 쓰는 성장 재료), **주간 1회**(골드와
 * DNA를 한 번에), **계정당 1회**(연구 재화, 가장 좋은 값). 계정당 1회가 가장 후한 이유는 다시
 * 오지 않기 때문이고, 반복 구매가 가능한 쪽이 가장 낮다.
 *
 * 검수 장부(시세표 기준 환산):
 * - `trade-cheesecake-supply`: 젬 150 → 치즈케이크 600 = 젬 300 → **200%**
 * - `trade-research-grant`: 젬 200 → 골드 140,000(젬 280) + DNA 14(젬 70) = 젬 350 → **175%**
 * - `trade-excavation-crate`: 젬 400 → 화석 4,000(젬 800) + 호박석 20(젬 200) = 젬 1,000 → **250%**
 */
export const TRADE_PACKAGES: readonly ProductDefinition[] = [
  {
    id: "trade-cheesecake-supply", storefront: "trade", category: "general", iconKey: "shop-product-supplies",
    name: "치즈케이크 보급", description: "치즈케이크 600개",
    acquisition: { kind: "currency", currency: "gems", amount: 150 },
    grants: [{ kind: "currency", currency: "cheesecake", amount: 600 }],
    defaultQuantity: 1, purchaseLimit: 3, refresh: "weekly",
    visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z",
  },
  {
    id: "trade-research-grant", storefront: "trade", category: "enhancement", iconKey: "shop-product-enhancement",
    name: "연구 보조금", description: "골드 140,000과 공용 DNA 조각 14개",
    acquisition: { kind: "currency", currency: "gems", amount: 200 },
    grants: [{ kind: "currency", currency: "gold", amount: 140_000 }, { kind: "currency", currency: "dnaFragments", amount: 14 }],
    defaultQuantity: 1, purchaseLimit: 1, refresh: "weekly",
    visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z",
  },
  {
    id: "trade-excavation-crate", storefront: "trade", category: "general", iconKey: "shop-product-supplies",
    name: "발굴 장비 보급함", description: "화석 4,000개와 호박석 20개",
    acquisition: { kind: "currency", currency: "gems", amount: 400 },
    grants: [{ kind: "currency", currency: "fossil", amount: 4_000 }, { kind: "currency", currency: "amber", amount: 20 }],
    defaultQuantity: 1, purchaseLimit: 1, refresh: "once",
    visibleFrom: "2026-01-01T00:00:00Z", visibleUntil: "2030-01-01T00:00:00Z",
  },
];
