import { describe, expect, it } from "vitest";
import { premiumStatusOf } from "../../src/ui/premiumStatus";

const paid = { kind: "currency", currency: "gems", amount: 100 } as const;

describe("프리미엄 상태 딱지", () => {
  it("살 수 있으면 딱지가 없다", () => {
    expect(premiumStatusOf({ purchasable: true, remaining: 1, acquisition: paid, refresh: "daily" })).toBeUndefined();
  });
  it("이용 중인 구독은 구매 가능 여부와 무관하게 「구독 중」이다", () => {
    expect(premiumStatusOf({ purchasable: false, remaining: 0, acquisition: paid, refresh: "none", subscription: { expiresAt: null, dailyBonusClaimed: false } })).toBe("subscribed");
  });
  it("무료 수령을 마쳤으면 「수령 완료」다", () => {
    expect(premiumStatusOf({ purchasable: false, remaining: 0, acquisition: { kind: "free" }, refresh: "daily" })).toBe("claimed");
  });
  it("다시 열리지 않는 상품은 「구매 완료」, 주기가 있는 상품은 「매진」이다", () => {
    expect(premiumStatusOf({ purchasable: false, remaining: 0, acquisition: paid, refresh: "none" })).toBe("purchased");
    expect(premiumStatusOf({ purchasable: false, remaining: 0, acquisition: paid, refresh: "once" })).toBe("purchased");
    expect(premiumStatusOf({ purchasable: false, remaining: 0, acquisition: paid, refresh: "weekly" })).toBe("soldOut");
  });
  it.each(["none", "once", "daily", "weekly", "monthly"] as const)("결제가 불가능해도 구매 횟수가 남은 %s 상품은 완료로 표시하지 않는다", (refresh) => {
    const acquisition = { kind: "platform_payment", platformProductId: "premium-test", basePriceKrw: 9900 } as const;
    expect(premiumStatusOf({ purchasable: false, remaining: 1, acquisition, refresh })).toBeUndefined();
  });
  it("주기 상품을 일부 구매했어도 남은 횟수가 있으면 매진으로 표시하지 않는다", () => {
    expect(premiumStatusOf({ purchasable: false, remaining: 2, acquisition: paid, refresh: "daily" })).toBeUndefined();
  });
});
