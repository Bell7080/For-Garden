import { BANNERS } from "./banners";
import type { ProductDefinition } from "./products";

const FROM = "2026-01-01T00:00:00Z";
const UNTIL = "2030-01-01T00:00:00Z";

/**
 * 마일리지 상점의 상품.
 *
 * **기준 단위는 마일리지 1 ≈ 젬 60**(화석·호박석 1개 = 젬 300 = 마일리지 5)이고 시세는 `TRADE_GEM_RATE`가
 * 갖는다. 에너지 드링크의 값은 **젬 충전의 가장 싼 1단계**(젬 50 → 스테미나 60, 누진 전)로 잰다 — 많이 채울수록
 * 오르는 값의 바닥이라 늘 보수적이다. 상품은 받는 것의 젬 값이 낸 값의 **1.0~1.25배** 안에 들게 한다(드링크 3개 =
 * 마일리지 2 → 1.25배, 드링크+ 2개 = 마일리지 3 → 1.11배, 골드·치즈케이크 → 1.17배). 마일리지는 **한 번에 2 이상**
 * 들게 해 한 개로 퉁치지 않는다. 화석·호박석은 시세 그대로, 주간 SSR 파편은 100~200의 위쪽 끝(200)이다. SR·R 파편은 중복이 바뀌는 마일리지(SR 8 · R 2)의 5배로 SR 40 · R 10이다
 * (`tests/unit/mileage.test.ts`). 만능 파편은 같은 등급 파편 값의 2배다(SR 80 · R 20). 기한이 있는 소비품은 7일을 기본으로 한다. 주간은 월요일, 일간은 매일 UTC
 * 자정에 돌아온다.
 *
 * **발굴권·토벌권은 젬으로 환산되지 않아 검증 대상 밖이지만 값은 프리미엄 장부와 맞춘다**(발굴권 1장 ≈ 젬 100, 토벌권 ≈ 50 —
 * `docs/premium-pricing-review.md`). 시세로는 마일리지 1~2에 해당하고 "한 번에 2 이상" 규칙에 따라 2로 둔다. 화석·호박석(5)과 같은 값이던 때는 발굴권이 화석 한 개와 같았다.
 *
 * 구역은 `category`(`weekly`·`daily`)로 가른다 — 화면이 좌측 하단 라벨 탭으로 갈아 끼운다.
 */
function mileage(
  id: string, category: "weekly" | "daily", iconKey: ProductDefinition["iconKey"], name: string, description: string,
  price: number, limit: number, grants: ProductDefinition["grants"],
): ProductDefinition {
  return {
    id, storefront: "mileage", category, iconKey, name, description,
    acquisition: { kind: "currency", currency: "dnaFragments", amount: price },
    grants, defaultQuantity: 1, purchaseLimit: limit, refresh: category, visibleFrom: FROM, visibleUntil: UNTIL,
  };
}

/** 한정 픽업 렐릭의 마일리지 값 — 스파크(픽업 천장)를 대신한다(응태 결정, 2026-11-09). */
export const MILEAGE_PICKUP_PRICE = 300;

/**
 * **한정 픽업 렐릭 — 스파크 대신 마일리지로 산다**(응태 결정, 2026-11-09).
 *
 * 픽업 배너(`pickupRelicIds.SSR`)마다 한 줄이 저절로 선다. 미보유면 **본체**를, 보유 중이면 **그 개체 파편 1장**을
 * 받는다 — 주간 SSR 파편과 같은 `relic_fragment` 경로라 서버가 그 둘을 가른다(첫 한 장은 개체 자체). SSR 돌파 I→II·II→III은
 * 파편 1장이라 산 값이 돌파 한 단계다. 명함은 20레벨이라 약하고, 마일리지 300은 연구 한 달 남짓의 적립이다.
 *
 * **배너 기간마다 한 번이다.** 새 픽업은 새 배너 ID를 쓰므로(`PITY_GROUP` 규칙과 같다) 상품 ID도 새로 서고, 한도는
 * 기간 키 없이(`refresh: "none"`) 그 ID에 묶인다. 배너 기간이 서버 일정으로 오면 `visibleFrom`·`visibleUntil`이 그 창을 따른다.
 * 값은 젬 환산 검사 밖이다(개체·파편은 젬 시세가 없다).
 */
function pickupProducts(): ProductDefinition[] {
  return BANNERS.flatMap((banner) => (banner.pickupRelicIds.SSR ?? []).map((relicId) => ({
    id: `mileage-pickup-${banner.id}-${relicId}`, storefront: "mileage" as const, category: "weekly" as const,
    iconKey: "shop-product-enhancement" as const, name: "한정 픽업 렐릭", description: "한정 픽업 렐릭 · 보유 시 파편 1개",
    acquisition: { kind: "currency" as const, currency: "dnaFragments" as const, amount: MILEAGE_PICKUP_PRICE },
    grants: [{ kind: "relic_fragment" as const, relicId, amount: 1 }],
    defaultQuantity: 1, purchaseLimit: 1, refresh: "none" as const, visibleFrom: FROM, visibleUntil: UNTIL,
  })));
}

export const MILEAGE_PRODUCTS: readonly ProductDefinition[] = [
  // 한정 픽업 렐릭이 주간 구역의 맨 앞, 그 뒤가 그 주의 SSR 파편이다.
  ...pickupProducts(),
  // 주간 — 그 주의 SSR 파편이 맨 앞이다.
  mileage("mileage-weekly-ssr", "weekly", "shop-product-enhancement", "이번 주 SSR 파편", "이번 주 점원의 파편 1개", 200, 1, [{ kind: "weekly_ssr_fragment", amount: 1 }]),
  mileage("mileage-weekly-sr", "weekly", "shop-product-enhancement", "이번 주 SR 파편", "이번 주 SR 파편 1개", 40, 1, [{ kind: "rotating_fragment", rarity: "SR", period: "weekly", amount: 1 }]),
  // 만능 파편 — 이번 주 파편 값의 **2배다**(SR 40 → 80 · R 10 → 20). 개체를 고르지 않아도 되는 값이다.
  mileage("mileage-weekly-universal-sr", "weekly", "shop-product-enhancement", "만능 SR 파편", "만능 SR 파편 1개", 80, 1, [{ kind: "item", itemId: "universal-fragment-sr", name: "만능 SR 파편", amount: 1 }]),
  mileage("mileage-weekly-universal-r", "weekly", "shop-product-enhancement", "만능 R 파편", "만능 R 파편 1개", 20, 1, [{ kind: "item", itemId: "universal-fragment-r", name: "만능 R 파편", amount: 1 }]),
  mileage("mileage-weekly-amber", "weekly", "shop-product-amber", "호박석 반출", "호박석 1개", 5, 10, [{ kind: "currency", currency: "amber", amount: 1 }]),
  mileage("mileage-weekly-fossil", "weekly", "shop-product-fossil", "화석 반출", "화석 1개", 5, 10, [{ kind: "currency", currency: "fossil", amount: 1 }]),
  mileage("mileage-weekly-tonic", "weekly", "shop-product-supplies", "고농축 음료 반출", "에너지 드링크+ 2개", 3, 2, [{ kind: "item", itemId: "stamina-tonic-large", name: "에너지 드링크+", amount: 2, expiresInDays: 7 }]),
  mileage("mileage-weekly-core", "weekly", "shop-product-ancient-core", "고대 핵 반출", "미지의 고대 핵 1개", 25, 1, [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }]),
  mileage("mileage-weekly-raid-ticket", "weekly", "shop-product-supplies", "토벌권 반출", "토벌권 1장", 2, 2, [{ kind: "item", itemId: "raid-ticket", name: "토벌권", amount: 1 }]),
  // 일간 — 매일 들러 소량씩 바꾸는 일반 품목.
  mileage("mileage-daily-r", "daily", "shop-product-enhancement", "오늘의 R 파편", "오늘의 R 파편 1개", 10, 1, [{ kind: "rotating_fragment", rarity: "R", period: "daily", amount: 1 }]),
  mileage("mileage-daily-gold", "daily", "shop-product-fossil", "연구 지원금", "골드 70,000개", 2, 2, [{ kind: "currency", currency: "gold", amount: 70_000 }]),
  mileage("mileage-daily-cheesecake", "daily", "shop-product-supplies", "치즈케이크 보급", "치즈케이크 280개", 2, 2, [{ kind: "currency", currency: "cheesecake", amount: 280 }]),
  mileage("mileage-daily-tonic", "daily", "shop-product-supplies", "음료 한 병", "에너지 드링크 3개", 2, 1, [{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 3, expiresInDays: 7 }]),
  mileage("mileage-daily-strata", "daily", "shop-product-supplies", "발굴권 반출", "발굴권 1장", 2, 1, [{ kind: "item", itemId: "strata-ticket", name: "발굴권", amount: 1 }]),
];
