import { describe, expect, it } from "vitest";
import type { ProductDto, ProductStorefront } from "../../src/api/contracts";
import { shopModel } from "../../src/ui/shopModel";
import { tradePopupModel } from "../../src/ui/tradePopupModel";

/** 필터 검증에 필요하지 않은 표시 필드는 한 팩토리에서 채워 storefront 의도만 드러낸다. */
function product(id: string, storefront: ProductStorefront): ProductDto {
  return { id, storefront, category: "general", iconKey: "shop-product-supplies", name: id, description: id, price: { currency: "fossil", amount: 1 }, grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", remaining: 1, purchasable: true };
}

/** 서로 다른 화면의 상품 ID가 모델 경계를 넘어 보존되지 않는지 고정한다. */
describe("storefront product models", () => {
  const mixed = [product("shop-item", "shop"), product("trade-item", "trade"), product("premium-item", "premium")];

  it("tradePopupModel preserves only trade products", () => {
    expect(tradePopupModel(mixed).map(({ id }) => id)).toEqual(["trade-item"]);
  });

  it("shopModel preserves only shop products", () => {
    expect(shopModel(mixed).map(({ id }) => id)).toEqual(["shop-item"]);
  });
});
