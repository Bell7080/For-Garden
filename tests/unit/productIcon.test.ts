import { describe, expect, it } from "vitest";
import { PRODUCTS, SHOP_PRODUCT_ICON_ASSETS } from "../../src/data/shopCatalog";
import { ITEM_ICON_ASSETS, ITEM_RASTER_ICON_ASSETS } from "../../src/ui/itemIcons";
import { CURRENCY_ICON_BY_WALLET } from "../../src/ui/currencyIcons";
import { productIconTexture, runeProductOf } from "../../src/ui/productIcon";
import type { ProductDto } from "../../src/api/contracts";

const asDto = (product: (typeof PRODUCTS)[number]): ProductDto => ({ ...product, remaining: 1, purchasable: true });
const KNOWN = new Set<string>([
  ...SHOP_PRODUCT_ICON_ASSETS.map(([key]) => key),
  ...ITEM_ICON_ASSETS.map(([key]) => key), ...ITEM_RASTER_ICON_ASSETS.map(([key]) => key),
  ...Object.values(CURRENCY_ICON_BY_WALLET),
]);

describe("상품 그림", () => {
  it("은 재화 상품이면 그 재화 그림, 아이템 상품이면 그 아이템 그림으로 선다", () => {
    const find = (id: string) => asDto(PRODUCTS.find((product) => product.id === id)!);
    expect(productIconTexture(find("arch-gold-exchange"))).toBe(CURRENCY_ICON_BY_WALLET.gold);
    expect(productIconTexture(find("arch-fossil-exchange"))).toBe(CURRENCY_ICON_BY_WALLET.fossil);
    expect(productIconTexture(find("shop-tonic-pack"))).toBe("item-stamina-tonic");
    expect(productIconTexture(find("arch-ancient-core"))).toBe("item-ancient-core");
  });

  it("은 룬이 아닌 모든 상점 상품의 그림이 실제로 읽히는 텍스처다", () => {
    for (const product of PRODUCTS) {
      if (product.storefront === "premium" || product.storefront === "mileage" || runeProductOf(asDto(product))) continue;
      expect(KNOWN.has(productIconTexture(asDto(product))), `${product.id} → ${productIconTexture(asDto(product))}`).toBe(true);
    }
  });

  it("은 룬 상품의 등급과 자리를 룬 액자에 넘기고 가짜 반출 허가 상품을 두지 않는다", () => {
    expect(runeProductOf({ grants: [{ kind: "rune", name: "x", amount: 1, rarity: "epic" }], runePart: 2 })).toEqual({ rarity: "epic", part: 2 });
    expect(PRODUCTS.some((product) => /반출 허가|인가$/.test(product.name))).toBe(false);
    expect(PRODUCTS.some((product) => product.grants.some((grant) => grant.kind === "item" && grant.itemId === "rune-dust"))).toBe(false);
  });
});
