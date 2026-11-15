import { describe, expect, it } from "vitest";
import KO from "../../src/i18n/ko";
import { CURRENCY_GUIDE } from "../../src/data/currencyGuide";
import { GUIDE_ROUTE_DESTINATION, guideRouteParams, type GuideRouteId } from "../../src/data/guideRoutes";
import { ITEM_SOURCE_ROUTES } from "../../src/data/itemSources";
import { PRODUCTS } from "../../src/data/products";
import { ITEMS } from "../../src/data/items";
import { itemDescription } from "../../src/ui/itemDescription";

/**
 * 안내창의 「획득처」·「사용처」 줄이 실제 규칙과 맞는지 — 줄은 ID이고 수는 상수에서 채워지므로,
 * 여기서는 그 연결이 끊기지 않았는지(문구·수·상점 상품)를 본다.
 */
const ROUTE_IDS = Object.keys(GUIDE_ROUTE_DESTINATION) as GuideRouteId[];
const text = (id: GuideRouteId): string => (KO as Record<string, string>)[`guide.route.${id}`] ?? "";

describe("안내창 줄", () => {
  it("모든 줄에 문구가 있고, 문구의 자리는 0이 아닌 수로 채워진다", () => {
    for (const id of ROUTE_IDS) {
      const sentence = text(id);
      expect(sentence, id).not.toBe("");
      const params = guideRouteParams(id);
      for (const [, name] of sentence.matchAll(/\{(\w+)\}/g)) {
        expect(params[name!], `${id}.${name}`).toBeDefined();
        expect(Number(params[name!]), `${id}.${name}`).toBeGreaterThan(0);
      }
    }
  });

  it("재화·아이템 안내가 가리키는 줄은 모두 정의된 줄이다", () => {
    const used = [...Object.values(CURRENCY_GUIDE).flatMap((entry) => [...entry.sources, ...entry.uses]), ...Object.values(ITEM_SOURCE_ROUTES).flat()];
    for (const id of used) expect(ROUTE_IDS, id).toContain(id);
  });

  it("상점 줄은 그 상점이 실제로 파는 것에만 붙는다", () => {
    const sells = (storefront: string, key: string): boolean => PRODUCTS.some((product) => product.storefront === storefront && product.grants.some((grant) => (grant.kind === "currency" && grant.currency === key) || (grant.kind === "item" && grant.itemId === key)));
    const storefrontOf: Partial<Record<GuideRouteId, string>> = { archaeologyShop: "archaeology", lootShop: "loot", duelShop: "duel", mileageShop: "mileage" };
    const checks: Array<[string, GuideRouteId]> = [
      ...Object.values(CURRENCY_GUIDE).flatMap((entry) => entry.sources.map((id) => [entry.key, id] as [string, GuideRouteId])),
      ...Object.entries(ITEM_SOURCE_ROUTES).flatMap(([itemId, routes]) => routes.map((id) => [itemId, id] as [string, GuideRouteId])),
    ];
    for (const [key, id] of checks) {
      const storefront = storefrontOf[id];
      if (!storefront || !PRODUCTS.some((product) => product.storefront === storefront)) continue;
      expect(sells(storefront, key), `${key} ← ${id}`).toBe(true);
    }
  });

  it("아이템 설명의 자리는 모두 규칙의 수로 채워진다", () => {
    for (const definition of ITEMS) expect(itemDescription(definition), definition.id).not.toMatch(/\{\w+\}/);
  });
});
