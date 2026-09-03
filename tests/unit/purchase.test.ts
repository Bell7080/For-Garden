import { describe, expect, it } from "vitest";
import { quotePurchase, totalGrantAmount } from "../../src/core/purchase";

describe("purchase", () => {
  it("남은 제한과 잔액 중 더 작은 실제 구매 가능 수량으로 요청을 제한한다", () => {
    // 5개가 남아도 250 재화로 단가 100 상품은 2개까지만 살 수 있다.
    expect(quotePurchase({ unitPrice: 100, remaining: 5, balance: 250 }, 99)).toEqual({
      quantity: 2, totalPrice: 200, maxQuantity: 2, affordableQuantity: 2, valid: true,
    });
  });

  it("수량을 1 이상의 정수로 만들고 총가격과 총 지급량을 계산한다", () => {
    expect(quotePurchase({ unitPrice: 180, remaining: 3, balance: 1_000 }, -4)).toMatchObject({ quantity: 1, totalPrice: 180 });
    expect(quotePurchase({ unitPrice: 180, remaining: 3, balance: 1_000 }, 2.9)).toMatchObject({ quantity: 2, totalPrice: 360 });
    expect(totalGrantAmount(100, 2)).toBe(200);
  });

  it("잔액이나 제한이 없으면 구매 불가 상태를 반환한다", () => {
    expect(quotePurchase({ unitPrice: 80, remaining: 2, balance: 79 }, 1)).toMatchObject({ maxQuantity: 0, valid: false });
    expect(quotePurchase({ unitPrice: 80, remaining: 0, balance: 800 }, 1)).toMatchObject({ maxQuantity: 0, valid: false });
  });
});
