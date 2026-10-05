import { describe, expect, it } from "vitest";
import { PRODUCTS } from "../../src/data/products";
import { MILEAGE_PRODUCTS } from "../../src/data/mileageShop";
import { findItem } from "../../src/data/items";
import { productExpiryDays } from "../../src/ui/productExpiry";

describe("상점 유통기한 표기", () => {
  it("지급 묶음의 날수가 앞서고 없으면 아이템 기본(7일)을 쓴다", () => {
    expect(productExpiryDays([{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1, expiresInDays: 3 }] as never)).toBe(3);
    expect(productExpiryDays([{ kind: "item", itemId: "stamina-tonic", name: "에너지 드링크", amount: 1 }] as never)).toBe(7);
    expect(productExpiryDays([{ kind: "currency", currency: "gold", amount: 10 }] as never)).toBeUndefined();
  });

  it("에너지 드링크를 파는 인게임 상품은 모두 7일이다", () => {
    for (const product of [...PRODUCTS, ...MILEAGE_PRODUCTS]) {
      if (product.storefront === "premium") continue;
      const hasDrink = product.grants.some((grant) => grant.kind === "item" && findItem(grant.itemId)?.useEffect.kind === "restore_stamina");
      if (hasDrink) expect(productExpiryDays(product.grants), product.id).toBe(7);
    }
  });
});
