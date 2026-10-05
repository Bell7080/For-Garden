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
 * 들게 해 한 개로 퉁치지 않는다. 화석·호박석은 시세 그대로, 주간 SSR 파편은 100~200의 가운데(150)다
 * (`tests/unit/mileage.test.ts`). 기한이 있는 소비품은 7일을 기본으로 한다. 주간은 월요일, 일간은 매일 UTC
 * 자정에 돌아온다.
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

export const MILEAGE_PRODUCTS: readonly ProductDefinition[] = [
  // 주간 — 그 주의 SSR 파편이 맨 앞이다.
  mileage("mileage-weekly-ssr", "weekly", "shop-product-enhancement", "이번 주 SSR 파편", "이번 주 점원의 파편 1개", 150, 1, [{ kind: "weekly_ssr_fragment", amount: 1 }]),
  mileage("mileage-weekly-amber", "weekly", "shop-product-amber", "호박석 반출", "호박석 1개", 5, 10, [{ kind: "currency", currency: "amber", amount: 1 }]),
  mileage("mileage-weekly-fossil", "weekly", "shop-product-fossil", "화석 반출", "화석 1개", 5, 10, [{ kind: "currency", currency: "fossil", amount: 1 }]),
  mileage("mileage-weekly-tonic", "weekly", "shop-product-supplies", "고농축 음료 반출", "에너지 드링크+ 2개", 3, 2, [{ kind: "item", itemId: "stamina-tonic-large", name: "에너지 드링크+", amount: 2, expiresInDays: 7 }]),
  mileage("mileage-weekly-core", "weekly", "shop-product-ancient-core", "고대 핵 반출", "미지의 고대 핵 1개", 25, 1, [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }]),
  mileage("mileage-weekly-raid-ticket", "weekly", "shop-product-supplies", "토벌권 반출", "토벌권 1장", 10, 2, [{ kind: "item", itemId: "raid-ticket", name: "토벌권", amount: 1 }]),
  // 일간 — 매일 들러 소량씩 바꾸는 일반 품목.
  mileage("mileage-daily-gold", "daily", "shop-product-fossil", "연구 지원금", "골드 70,000개", 2, 2, [{ kind: "currency", currency: "gold", amount: 70_000 }]),
  mileage("mileage-daily-cheesecake", "daily", "shop-product-supplies", "치즈케이크 보급", "치즈케이크 280개", 2, 2, [{ kind: "currency", currency: "cheesecake", amount: 280 }]),
  mileage("mileage-daily-tonic", "daily", "shop-product-supplies", "음료 한 병", "에너지 드링크 3개", 2, 1, [{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 3, expiresInDays: 7 }]),
  mileage("mileage-daily-strata", "daily", "shop-product-supplies", "발굴권 반출", "발굴권 1장", 5, 1, [{ kind: "item", itemId: "strata-ticket", name: "발굴권", amount: 1 }]),
];
