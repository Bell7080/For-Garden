import type { ProductDefinition } from "./products";

const FROM = "2026-01-01T00:00:00Z";
const UNTIL = "2030-01-01T00:00:00Z";

/**
 * 결투 상점에서 **투사의 휘장 한 개가 젬 몇 개 값인가**.
 *
 * 휘장은 젬으로 사는 길이 없는 증표라 무역 시세표(`TRADE_GEM_RATE`)에는 칸만 채워 두었고, 값은 이 상점이 잰다.
 * 결투는 하루 다섯 번(이기면 20 · 지면 8)이라 하루 벌이가 휘장 70~100쯤이다 — 0.5로 두면 하루 몫이 일일 품목
 * 셋을 사고 남는 정도이고, 주간 화석 한 개는 닷새를 모아야 산다. 전리품 상점의 토벌 증표와 같은 무게다.
 */
export const DUEL_EMBLEM_GEM_VALUE = 0.5;

/**
 * 시세가 없는 아이템 지급의 젬 값 — 값의 띠(1.0~1.25배)를 잴 때만 쓴다. 에너지 드링크는 젬 충전의 가장 싼 1단계
 * (젬 50 → 스테미나 60)로, 드링크+는 그 두 배로 잰다(마일리지 상점과 같은 기준). 표에 없는 아이템(고대 핵·복원
 * 결정)은 시세가 없어 띠 검사에서 빠진다.
 */
export const DUEL_SHOP_ITEM_GEM_VALUE: Readonly<Record<string, number>> = {
  "stamina-tonic": 50,
  "stamina-tonic-large": 100,
};

/**
 * 결투 상점의 상품 — 값은 전부 **투사의 휘장**이고 다른 재화로 사는 길이 없다(젬으로 사면 휘장이 무엇을 위한 것인지
 * 말하지 못한다). 받는 것의 젬 값이 낸 값의 **1.0~1.25배** 안에 든다(`tests/unit/duelShop.test.ts`).
 *
 * 탭은 **언제 돌아오는 자리인가**로 가른다(`category` = `refresh`) — 일일은 매일, 주간은 월요일, 특가는 매달.
 * 성장 재료(고대 핵·복원 결정)는 레이드·인양 상점과 겹쳐도 된다 — 한쪽에만 두면 그 콘텐츠를 돌지 않는 사람의
 * 성장이 막힌다.
 */
function duel(
  id: string, category: "daily" | "weekly" | "special", iconKey: ProductDefinition["iconKey"], name: string,
  price: number, limit: number, grants: ProductDefinition["grants"],
): ProductDefinition {
  return {
    id, storefront: "duel", category, iconKey, name, description: "",
    acquisition: { kind: "currency", currency: "duelEmblem", amount: price },
    grants, defaultQuantity: 1, purchaseLimit: limit, refresh: category === "special" ? "monthly" : category,
    visibleFrom: FROM, visibleUntil: UNTIL,
  };
}

export const DUEL_PRODUCTS: readonly ProductDefinition[] = [
  duel("duel-daily-cheesecake", "daily", "shop-product-supplies", "결투 보급 급여", 90, 1, [{ kind: "currency", currency: "cheesecake", amount: 100 }]),
  duel("duel-daily-gold", "daily", "shop-product-fossil", "결투 포상금", 70, 1, [{ kind: "currency", currency: "gold", amount: 20_000 }]),
  duel("duel-daily-tonic", "daily", "shop-product-supplies", "투사의 음료", 90, 1, [{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1, expiresInDays: 7 }]),
  duel("duel-weekly-fossil", "weekly", "shop-product-fossil", "화석", 520, 2, [{ kind: "currency", currency: "fossil", amount: 1 }]),
  duel("duel-weekly-amber", "weekly", "shop-product-amber", "호박석", 520, 2, [{ kind: "currency", currency: "amber", amount: 1 }]),
  duel("duel-weekly-gems", "weekly", "shop-product-gems", "결투 정산 결정", 70, 2, [{ kind: "currency", currency: "gems", amount: 40 }]),
  duel("duel-weekly-tonic", "weekly", "shop-product-supplies", "고농축 투사의 음료", 170, 2, [{ kind: "item", itemId: "stamina-tonic-large", name: "에너지 드링크+", amount: 1, expiresInDays: 7 }]),
  duel("duel-monthly-refined-core", "special", "shop-product-refined-core", "정제된 고대 핵", 300, 1, [{ kind: "item", itemId: "refined-core", name: "정제된 고대 핵", amount: 1 }]),
  duel("duel-monthly-crystal", "special", "shop-product-restoration-crystal", "완전 복원 결정", 340, 1, [{ kind: "item", itemId: "restoration-crystal", name: "완전 복원 결정", amount: 1 }]),
];
