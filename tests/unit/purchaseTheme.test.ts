import { describe, expect, it } from "vitest";
import { PURCHASE_THEME_IDS, purchaseThemeOf } from "../../src/core/purchaseTheme";
import { PRODUCTS } from "../../src/data/shopCatalog";
import { PURCHASE_FRAME, purchaseFrameBoxes, purchaseFrameSlots } from "../../src/ui/purchaseFrameLayout";
import { PURCHASE_THEME_STYLE } from "../../src/ui/purchaseThemeStyle";

const byId = (id: string) => {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(id);
  return product;
};

describe("현금 결제 팝업 테마", () => {
  it("상품을 지급 목록에서 다섯 테마 중 하나로 가른다", () => {
    expect(purchaseThemeOf(byId("premium-archaeology-pass"))).toBe("pass");
    expect(purchaseThemeOf(byId("premium-archaeology-support"))).toBe("archaeology");
    expect(purchaseThemeOf(byId("premium-excavation"))).toBe("archaeology");
    expect(purchaseThemeOf(byId("premium-research-start"))).toBe("gacha");
    expect(purchaseThemeOf(byId("premium-monthly-amber"))).toBe("gacha");
    expect(purchaseThemeOf(byId("premium-research-grand"))).toBe("gacha");
    expect(purchaseThemeOf(byId("premium-daily-deal"))).toBe("currency");
    expect(purchaseThemeOf(byId("premium-monthly"))).toBe("pass");
    expect(purchaseThemeOf(byId("premium-raid-bundle"))).toBe("basic");
  });

  it("모든 현금 상품이 스타일이 있는 테마로 떨어지고 다섯 테마를 모두 쓴다", () => {
    const used = new Set<string>();
    for (const product of PRODUCTS.filter((p) => p.acquisition.kind === "platform_payment")) {
      const id = purchaseThemeOf(product);
      expect(PURCHASE_THEME_STYLE[id]).toBeDefined();
      used.add(id);
    }
    for (const id of PURCHASE_THEME_IDS) expect(PURCHASE_THEME_STYLE[id]).toBeDefined();
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
});

describe("현금 결제 팝업 틀", () => {
  it("상품 개수가 몇이든 액자가 줄 안에 들고 서로 겹치지 않는다", () => {
    for (let n = 1; n <= PURCHASE_FRAME.maxTiles; n += 1) {
      const { size, xs } = purchaseFrameSlots(n);
      expect(xs[0] - size / 2).toBeGreaterThanOrEqual(-PURCHASE_FRAME.inner / 2);
      expect(xs[n - 1] + size / 2).toBeLessThanOrEqual(PURCHASE_FRAME.inner / 2);
      for (let i = 1; i < n; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(size);
    }
  });

  it("세로 칸이 겹치지 않고 판 안에 든다", () => {
    for (let n = 1; n <= PURCHASE_FRAME.maxTiles; n += 1) {
      const boxes = purchaseFrameBoxes(n);
      for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
      expect(boxes[0].top).toBeGreaterThan(-PURCHASE_FRAME.height / 2);
      expect(boxes[boxes.length - 1].bottom).toBeLessThan(PURCHASE_FRAME.height / 2);
    }
  });
});
