import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/buildFlavor", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/core/buildFlavor")>(), QA_TOOLS_ENABLED: false, QA_ALL_EVENTS: false,
}));

import { GIFTING_ENABLED, GIFT_PAYMENTS_ENABLED } from "../../src/core/gifting";
import { FakeServer } from "../../src/api/FakeServer";
import type { GameApi } from "../../src/api/contracts";
import type { GiftContext } from "../../src/server/playerGifts";
import { runGiftPurchase } from "../../src/api/platformPurchase";
import { giftPayment } from "../../src/platform/payment";
import { createDefaultSession } from "../../src/state/session";

afterEach(() => vi.unstubAllGlobals());

describe("일반 빌드 선물 노출과 결제 차단", () => {
  it("화면은 열어도 네이티브 결제창과 주문 API는 부르지 않는다", async () => {
    expect(GIFTING_ENABLED).toBe(true);
    expect(GIFT_PAYMENTS_ENABLED).toBe(false);
    const requestPayment = vi.fn();
    const prepareGift = vi.fn();
    vi.stubGlobal("window", { __PF_PAYMENT__: { requestPayment } });
    expect(giftPayment().supported).toBe(false);
    expect(await runGiftPurchase({ prepareGift } as unknown as GameApi, { requestPayment }, "b", "premium-gems-small"))
      .toEqual({ status: "unsupported" });
    expect(requestPayment).not.toHaveBeenCalled();
    expect(prepareGift).not.toHaveBeenCalled();
  });

  it("서버 직접 호출과 QA 옵션으로도 전송할 수 없고 상품 조회는 가능하다", async () => {
    const giftContext: GiftContext = {
      playerId: "a", sender: { guest: true, ageRestricted: false, blocked: false, oldestClearedOwnPaymentAt: null, lastOwnRefundAt: null, ownPayments: [], storeRegion: null },
      recipients: { b: { id: "b", name: "B", friendSince: new Date().toISOString(), active: true, guest: true, storeRegion: null } }, orders: [], changes: [],
    };
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, persistSession: () => undefined, giftContext, qaGiftEligibility: true });
    const options = (await api.getGiftOptions({ recipientId: "b" })).options;
    expect(options).toHaveLength(6);
    expect(options.every(option => !option.eligible && option.reason === "guest")).toBe(true);
    await expect(api.prepareGift({ recipientId: "b", productId: options[0].productId, requestId: "blocked" })).rejects.toMatchObject({ code: "GIFT_UNAVAILABLE" });
    await expect(api.sendGift({ orderId: "blocked", verificationId: "forged", requestId: "blocked" })).rejects.toMatchObject({ code: "GIFT_UNAVAILABLE" });
    expect(giftContext.orders).toEqual([]);
    expect(giftContext.changes).toEqual([]);
  });
});
