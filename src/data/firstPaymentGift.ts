import type { ProductGrant } from "./products";

/**
 * 계정 첫 결제 선물 — 어떤 상품이든 **플랫폼 결제가 처음 확정되는 순간** 한 번 함께 준다(응태 승인, 2026-11-09).
 *
 * 상품마다의 첫 구매 보너스(`firstPurchaseBonus` — 다이아 두 배)와는 다른 축이다: 그것은 상품 하나의 첫 구매이고
 * 이것은 계정 전체의 첫 결제다. 지급은 `FakeServer.fulfillPlatformPurchase` 한 곳이 같은 거래 안에서 확정하고,
 * 받았는지는 업적 저장의 `firstPaymentGift`가 기억한다. 테두리는 `giftFrames`에 더해 열린다.
 */
export const FIRST_PAYMENT_GIFT = {
  grants: [
    { kind: "item", itemId: "sr-select-ticket", name: "SR 렐릭 선택권", amount: 1 },
    { kind: "currency", currency: "fossil", amount: 5 },
  ] as const satisfies readonly ProductGrant[],
  frameId: "patron",
} as const;
