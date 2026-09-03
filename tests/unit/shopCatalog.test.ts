import { describe, expect, it } from "vitest";
import { PRODUCTS, SHOP_PRODUCT_ICON_ASSETS, SHOP_TABS } from "../../src/data/shopCatalog";

/** 카탈로그 탭과 상품 메타데이터가 화면 코드 없이 완결되는지 검증한다. */
describe("shop catalog", () => {
  it("owns the requested tab order and gives every product a valid category", () => {
    // 기획 순서는 배열 순서 자체이며 상품은 반드시 그중 한 탭에 속해야 한다.
    expect(SHOP_TABS.map(({ id }) => id)).toEqual(["general", "enhancement", "rune"]);
    const categories = new Set(SHOP_TABS.map(({ id }) => id));
    expect(PRODUCTS.every(({ category }) => categories.has(category))).toBe(true);
  });

  it("registers every product icon key in the temporary asset table", () => {
    // 최종 원화 경로가 바뀌어도 데이터가 가리키는 key 누락은 로딩 전에 잡는다.
    const iconKeys = new Set(SHOP_PRODUCT_ICON_ASSETS.map(([key]) => key));
    expect(PRODUCTS.every(({ iconKey }) => iconKeys.has(iconKey))).toBe(true);
  });
});
