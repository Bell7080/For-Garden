import { describe, expect, it } from "vitest";
import { DUEL_EMBLEM_GEM_VALUE, DUEL_PRODUCTS, DUEL_SHOP_ITEM_GEM_VALUE } from "../../src/data/duelShop";
import { SHOP_STAGE_PRESENTATION, shopStagePresentation } from "../../src/data/shopPresentation";
import { TRADE_GEM_RATE } from "../../src/data/tradePackages";
import type { ProductGrant } from "../../src/data/products";

/** 지급 묶음의 젬 값. 시세가 없는 아이템이 섞이면 `undefined`다(띠 검사에서 빠진다). */
function grantsGemValue(grants: readonly ProductGrant[]): number | undefined {
  let sum = 0;
  for (const grant of grants) {
    if (grant.kind === "currency") sum += grant.amount / TRADE_GEM_RATE[grant.currency];
    else if (grant.kind === "item" && DUEL_SHOP_ITEM_GEM_VALUE[grant.itemId] !== undefined) sum += grant.amount * DUEL_SHOP_ITEM_GEM_VALUE[grant.itemId];
    else return undefined;
  }
  return sum;
}

describe("결투 상점", () => {
  it("은 투사의 휘장으로만 판다", () => {
    for (const product of DUEL_PRODUCTS) {
      expect(product.storefront, product.id).toBe("duel");
      expect(product.acquisition, product.id).toMatchObject({ kind: "currency", currency: "duelEmblem" });
    }
  });

  it("의 탭은 돌아오는 주기와 같다", () => {
    const refreshOf = { daily: "daily", weekly: "weekly", special: "monthly" } as const;
    const tabs = SHOP_STAGE_PRESENTATION.duel.tabs.map((tab) => tab.id);
    for (const product of DUEL_PRODUCTS) {
      expect(tabs, product.id).toContain(product.category);
      expect(product.refresh, product.id).toBe(refreshOf[product.category as keyof typeof refreshOf]);
    }
    // 탭마다 적어도 한 품목은 선다 — 빈 탭은 덜 만든 화면으로 읽힌다.
    for (const tab of tabs) expect(DUEL_PRODUCTS.some((product) => product.category === tab), tab).toBe(true);
  });

  it("의 값은 받는 것의 1.0~1.25배 안에 든다", () => {
    let checked = 0;
    for (const product of DUEL_PRODUCTS) {
      const value = grantsGemValue(product.grants ?? []);
      if (value === undefined || product.acquisition.kind !== "currency") continue;
      const ratio = value / (product.acquisition.amount * DUEL_EMBLEM_GEM_VALUE);
      expect(ratio, product.id).toBeGreaterThanOrEqual(1);
      expect(ratio, product.id).toBeLessThanOrEqual(1.25);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("무대는 결투 자리 표를 읽는다", () => {
    expect(shopStagePresentation("duel")).toBe(SHOP_STAGE_PRESENTATION.duel);
    expect(SHOP_STAGE_PRESENTATION.duel.currencies).toBe("duel");
  });
});
