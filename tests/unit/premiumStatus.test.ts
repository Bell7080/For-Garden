import { describe, expect, it } from "vitest";
import { premiumStatusOf } from "../../src/ui/premiumStatus";

const paid = { kind: "currency", currency: "gems", amount: 100 } as const;

describe("프리미엄 상태 딱지", () => {
  it("살 수 있으면 딱지가 없다", () => {
    expect(premiumStatusOf({ purchasable: true, acquisition: paid, refresh: "daily" })).toBeUndefined();
  });
  it("이용 중인 구독은 구매 가능 여부와 무관하게 「구독 중」이다", () => {
    expect(premiumStatusOf({ purchasable: false, acquisition: paid, refresh: "none", subscription: { expiresAt: null, dailyBonusClaimed: false } })).toBe("subscribed");
  });
  it("무료 수령을 마쳤으면 「수령 완료」다", () => {
    expect(premiumStatusOf({ purchasable: false, acquisition: { kind: "free" }, refresh: "daily" })).toBe("claimed");
  });
  it("다시 열리지 않는 상품은 「구매 완료」, 주기가 있는 상품은 「매진」이다", () => {
    expect(premiumStatusOf({ purchasable: false, acquisition: paid, refresh: "none" })).toBe("purchased");
    expect(premiumStatusOf({ purchasable: false, acquisition: paid, refresh: "once" })).toBe("purchased");
    expect(premiumStatusOf({ purchasable: false, acquisition: paid, refresh: "weekly" })).toBe("soldOut");
  });
});
