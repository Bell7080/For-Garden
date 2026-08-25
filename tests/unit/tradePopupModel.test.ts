import { describe, expect, it } from "vitest";
import type { ProductDto, PurchaseProductResponse } from "../../src/api/contracts";
import { beginTradePurchase, closeTradePopup, finishTradePurchase, initialTradePopupState, loadTradeProducts, openTradePopup } from "../../src/ui/tradePopupModel";

/** 상태 모델 테스트에 필요한 최소 서버 상품을 화면 경계별로 만든다. */
function product(id: string, storefront: ProductDto["storefront"]): ProductDto {
  return { id, storefront, name: id, description: id, price: { currency: storefront === "trade" ? "fossil" : "real_money", amount: 1 }, grants: [], purchaseLimit: 3, refresh: "daily", remaining: 3, purchasable: storefront === "trade" };
}

describe("trade popup model", () => {
  it("중복 열기는 같은 상태를 유지하고 닫으면 요청 잠금을 해제한다", () => {
    const opened = openTradePopup(initialTradePopupState());
    expect(openTradePopup(opened)).toBe(opened);
    const pending = beginTradePurchase(opened, "trade-a");
    expect(beginTradePurchase(pending, "trade-b")).toBe(pending);
    expect(closeTradePopup(pending)).toMatchObject({ open: false, pendingProductId: undefined });
  });

  it("무역 상품만 고르고 서버 응답의 남은 횟수만 병합한다", () => {
    const loaded = loadTradeProducts(openTradePopup(initialTradePopupState()), [product("trade-a", "trade"), product("paid-a", "premium")]);
    expect(loaded.products.map(({ id }) => id)).toEqual(["trade-a"]);
    // 지갑은 UI 모델이 계산하지 않고 응답 계약을 만족시키기 위한 서버 스냅샷으로만 둔다.
    const result = { productId: "trade-a", remaining: 2, wallet: { fossil: 9 } } as unknown as PurchaseProductResponse;
    expect(finishTradePurchase(beginTradePurchase(loaded, "trade-a"), result).products[0]).toMatchObject({ remaining: 2, purchasable: true });
  });
});
