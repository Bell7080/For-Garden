import type { ProductDefinition } from "./products";

const FROM = "2026-01-01T00:00:00Z";
const UNTIL = "2030-01-01T00:00:00Z";

/**
 * 마일리지 상점의 상품.
 *
 * **기준 단위는 마일리지 1 ≈ 젬 60 ≈ 골드 30,000 ≈ 치즈케이크 120 ≈ 화석 0.2개**이고, 모든 상품은 이
 * 기준과 같거나 불리하게 매겼다(`tests/unit/mileageShop.test.ts`). 마일리지는 뽑기에서 모이는
 * 재화라 이 가격이 싸면 뽑기 환급이 되어 버린다. 주간은 월요일, 일간은 매일 UTC 자정에 돌아온다.
 *
 * 구역은 `category`(`weekly`·`daily`)로 가른다 — 화면이 한 판 안에서 위 주간 · 아래 일간으로 세운다.
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
  mileage("mileage-weekly-ssr", "weekly", "shop-product-enhancement", "이번 주 SSR 파편", "이번 주 점원의 파편 1개", 60, 1, [{ kind: "weekly_ssr_fragment", amount: 1 }]),
  mileage("mileage-weekly-amber", "weekly", "shop-product-amber", "호박석 반출", "호박석 1개", 15, 1, [{ kind: "currency", currency: "amber", amount: 1 }]),
  mileage("mileage-weekly-fossil", "weekly", "shop-product-fossil", "화석 묶음", "화석 5개", 25, 1, [{ kind: "currency", currency: "fossil", amount: 5 }]),
  mileage("mileage-weekly-tonic", "weekly", "shop-product-supplies", "고농축 음료 반출", "에너지 드링크+ 3개", 5, 2, [{ kind: "item", itemId: "stamina-tonic-large", name: "에너지 드링크+", amount: 3, expiresInDays: 3 }]),
  mileage("mileage-weekly-dust", "weekly", "shop-product-rune", "정제 가루 대량 반출", "룬 가루 100개", 8, 2, [{ kind: "item", itemId: "rune-dust", name: "룬 가루", amount: 100 }]),
  mileage("mileage-weekly-core", "weekly", "shop-product-ancient-core", "고대 핵 반출", "미지의 고대 핵 1개", 25, 1, [{ kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 1 }]),
  mileage("mileage-weekly-raid-ticket", "weekly", "shop-product-supplies", "토벌권 반출", "토벌권 1장", 10, 2, [{ kind: "item", itemId: "raid-ticket", name: "토벌권", amount: 1 }]),
  // 일간 — 매일 들러 소량씩 바꾸는 일반 품목.
  mileage("mileage-daily-fossil", "daily", "shop-product-fossil", "화석 반출", "화석 1개", 5, 1, [{ kind: "currency", currency: "fossil", amount: 1 }]),
  mileage("mileage-daily-gold", "daily", "shop-product-fossil", "연구 지원금", "골드 20,000개", 1, 3, [{ kind: "currency", currency: "gold", amount: 20_000 }]),
  mileage("mileage-daily-cheesecake", "daily", "shop-product-supplies", "치즈케이크 보급", "치즈케이크 100개", 1, 3, [{ kind: "currency", currency: "cheesecake", amount: 100 }]),
  mileage("mileage-daily-tonic", "daily", "shop-product-supplies", "음료 한 병", "에너지 드링크 1개", 1, 2, [{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1, expiresInDays: 3 }]),
  mileage("mileage-daily-dust", "daily", "shop-product-rune", "정제 가루 반출", "룬 가루 40개", 2, 1, [{ kind: "item", itemId: "rune-dust", name: "룬 가루", amount: 40 }]),
  mileage("mileage-daily-strata", "daily", "shop-product-supplies", "발굴권 반출", "발굴권 1장", 2, 1, [{ kind: "item", itemId: "strata-ticket", name: "발굴권", amount: 1 }]),
];
