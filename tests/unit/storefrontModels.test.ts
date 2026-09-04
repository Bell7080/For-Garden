import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { ProductDto, ProductStorefront } from "../../src/api/contracts";
import { productsForShopCategory, shopModel } from "../../src/ui/shopModel";

/** 필터 검증에 필요하지 않은 표시 필드는 한 팩토리에서 채워 storefront 의도만 드러낸다. */
function product(id: string, storefront: ProductStorefront): ProductDto {
  return { id, storefront, category: "general", iconKey: "shop-product-supplies", name: id, description: id, acquisition: { kind: "currency", currency: "fossil", amount: 1 }, grants: [], defaultQuantity: 1, purchaseLimit: 1, refresh: "once", remaining: 1, purchasable: true };
}

/** 일반 상점 모델이 다른 서버 storefront의 상품을 끌어오지 않는지 고정한다. */
describe("storefront product models", () => {
  const mixed = [product("shop-item", "shop"), product("trade-item", "trade"), product("premium-item", "premium")];

  it("상점 씬은 storefront 고르기를 검증된 모델에 맡긴다", () => {
    // PR #277이 지키려던 규칙을 그 사이 사라진 TradePopup 대신 지금 남은 진입점에 옮긴 것이다.
    // 생산 화면이 같은 storefront 규칙을 다시 쓰면 한쪽만 고쳐도 다른 쪽이 옛 규칙으로 남는다.
    const source = readFileSync(new URL("../../src/scenes/ShopScene.ts", import.meta.url), "utf8");
    expect(source).toContain("shopModel(response.products)");
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
