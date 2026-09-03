import { describe, expect, it } from "vitest";
import type { ProductAcquisition } from "../../src/data/products";
import { productActionModel } from "../../src/core/productAcquisition";
import { confirmPlatformProduct } from "../../src/core/productConfirmation";

/** 네 가지 판별자를 모두 구체화해 계약 필드 누락을 컴파일 단계에서도 막는다. */
const METHODS: ProductAcquisition[] = [
  { kind: "currency", currency: "fossil", amount: 100 },
  { kind: "platform_payment", platformProductId: "pack.one", displayPrice: "₩1,000" },
  { kind: "free" },
  { kind: "rewarded_ad", slotId: "shop.daily", dailyLimitUtc: 3 },
];

describe("product acquisition contract", () => {
  it("방식에서 버튼 라벨과 가격을 파생하며 무료를 0 가격으로 표시하지 않는다", () => {
    expect(METHODS.map((method) => productActionModel(method).label)).toEqual(["교환", "구매", "무료 수령", "광고 보고 받기"]);
    expect(productActionModel(METHODS[2]).priceText).toBe("무료");
    expect(productActionModel(METHODS[3]).priceText).toBe("광고 · 일 3회");
  });

  it("중복 요청과 UTC 일일 제한 사유를 공용 모델 상태로 고정한다", () => {
    expect(productActionModel(METHODS[0], { remaining: 1, pending: true }).disabledReason).toBe("이미 처리 중입니다.");
    expect(productActionModel(METHODS[3], { remaining: 0 }).disabledReason).toBe("UTC 일일 제한에 도달했습니다.");
  });

  it("플랫폼 성공과 취소가 어댑터 밖에서 영수증을 만들지 않는다", async () => {
    const paid = { requestPayment: async () => ({ status: "completed" as const, receipt: { platform: "test", productId: "pack.one", transactionId: "tx", payload: "receipt" } }) };
    await expect(confirmPlatformProduct(METHODS[1] as Extract<ProductAcquisition, { kind: "platform_payment" }>, paid, async (proof) => ({ status: "confirmed", proof }))).resolves.toEqual({ status: "confirmed", proof: "receipt" });
    const cancelled = { requestPayment: async () => ({ status: "cancelled" as const }) };
    await expect(confirmPlatformProduct(METHODS[1] as Extract<ProductAcquisition, { kind: "platform_payment" }>, cancelled, async () => ({ status: "duplicate" }))).resolves.toEqual({ status: "cancelled" });
  });
});

// 광고 브리지는 테스트마다 지워 실제 웹 미지원 상태가 다른 테스트에 새지 않게 한다.
describe("rewarded ad product confirmation", () => {
  it("성공 토큰, 취소, 서버 중복과 일일 제한 결과를 그대로 보존한다", async () => {
    const { confirmRewardedAdProduct } = await import("../../src/core/productConfirmation");
    const acquisition = METHODS[3] as Extract<ProductAcquisition, { kind: "rewarded_ad" }>;
    Object.assign(globalThis, { window: { __PF_REWARDED_ADS__: { present: async () => ({ status: "completed", verificationToken: "ad-proof" }) } } });
    await expect(confirmRewardedAdProduct(acquisition, async (proof) => ({ status: "confirmed", proof }))).resolves.toEqual({ status: "confirmed", proof: "ad-proof" });
    await expect(confirmRewardedAdProduct(acquisition, async () => ({ status: "duplicate" }))).resolves.toEqual({ status: "duplicate" });
    await expect(confirmRewardedAdProduct(acquisition, async () => ({ status: "daily_limit" }))).resolves.toEqual({ status: "daily_limit" });
    Object.assign(globalThis, { window: { __PF_REWARDED_ADS__: { present: async () => ({ status: "dismissed" }) } } });
    await expect(confirmRewardedAdProduct(acquisition, async () => ({ status: "confirmed", proof: "never" }))).resolves.toEqual({ status: "cancelled" });
    Reflect.deleteProperty(globalThis, "window");
  });
});
