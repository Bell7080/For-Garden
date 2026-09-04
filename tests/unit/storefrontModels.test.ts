import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { ProductDto, ProductStorefront } from "../../src/api/contracts";
import { productsForShopCategory, shopModel } from "../../src/ui/shopModel";
import { tradePopupModel } from "../../src/ui/tradePopupModel";

/** 필터 검증에 필요하지 않은 표시 필드는 한 팩토리에서 채워 storefront 의도만 드러낸다. */
function product(id: string, storefront: ProductStorefront): ProductDto {
  return { id, storefront, category: "general", iconKey: "shop-product-supplies", name: id, description: id, acquisition: { kind: "currency", currency: "fossil", amount: 1 }, grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", remaining: 1, purchasable: true };
}

/** 서로 다른 화면의 상품 ID가 모델 경계를 넘어 보존되지 않는지 고정한다. */
describe("storefront product models", () => {
  const mixed = [product("shop-item", "shop"), product("trade-item", "trade"), product("premium-item", "premium")];

  it("tradePopupModel preserves only trade products", () => {
    expect(tradePopupModel(mixed).map(({ id }) => id)).toEqual(["trade-item"]);
  });

  it("TradePopup refresh delegates catalog selection to the tested model", () => {
    // 생산 프리팹이 같은 storefront 규칙을 다시 쓰지 않고 위에서 검증한 모델을 호출하는지 고정한다.
    const source = readFileSync(new URL("../../src/ui/TradePopup.ts", import.meta.url), "utf8");
    expect(source).toContain("tradePopupModel(response.products)");
    expect(source).not.toMatch(/response\.products\.filter\s*\(/);
  });

  it("shopModel preserves only shop products", () => {
    expect(shopModel(mixed).map(({ id }) => id)).toEqual(["shop-item"]);
  });

  it("탭별 상품 필터는 다른 storefront와 다른 분류를 동시에 제외한다", () => {
    const enhancement = { ...product("shop-enhancement", "shop"), category: "enhancement" as const };
    expect(productsForShopCategory([...mixed, enhancement], "enhancement").map(({ id }) => id)).toEqual(["shop-enhancement"]);
  });
});
