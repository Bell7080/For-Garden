import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { runPlatformRestore } from "../../src/api/platformPurchase";
import type { PlatformPaymentAdapter, PlatformReceipt } from "../../src/api/PlatformPayment";
import { UnsupportedPlatformPaymentAdapter } from "../../src/api/PlatformPayment";
import { appendGiftLog, GIFT_LOG_LIMIT, giftHistoryFromJournal, maskTransactionId, purchaseHistoryFromJournal } from "../../src/core/purchaseHistory";
import { emptyServerJournal, isValidServerJournal } from "../../src/core/serverJournal";
import { PRODUCTS } from "../../src/data/shopCatalog";
import { createDefaultSession } from "../../src/state/session";

let clock = Date.parse("2026-11-09T12:00:00Z");
function server() {
  const state = createDefaultSession(); state.itemInventory = [];
  const api = new FakeServer(state, { latencyMs: 0, now: () => new Date(clock), persistSession: () => undefined });
  return { state, api };
}
const platformId = (id: string): string => {
  const product = PRODUCTS.find(candidate => candidate.id === id)!;
  if (product.acquisition.kind !== "platform_payment") throw new Error(id);
  return product.acquisition.platformProductId;
};
const receipt = (id: string, tx: string): PlatformReceipt => ({ platform: "test", productId: platformId(id), transactionId: tx, payload: `verified-receipt:${id}:${tx}` });
async function buy(api: FakeServer, id: string, tx: string) {
  const verified = await api.verifyPurchaseReceipt({ productId: id, platform: "test", receipt: `verified-receipt:${id}:${tx}`, requestId: `verify-${tx}` });
  return api.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: `fulfill-${tx}` });
}
const store = (receipts: PlatformReceipt[]): PlatformPaymentAdapter => ({
  requestPayment: async () => ({ status: "cancelled" }),
  restorePurchases: async () => ({ status: "completed", receipts }),
});

describe("결제 기록", () => {
  it("거래 ID는 끝 네 자리만 남긴다", () => {
    expect(maskTransactionId("GPA.3392-1234-5678-abcd")).toBe("••••abcd");
    expect(maskTransactionId("")).toBe("••••????");
  });

  it("지급을 마친 플랫폼 거래만 최근 것부터, 지급 시각·지급 내용과 함께 돌려준다", async () => {
    const { api } = server();
    clock = Date.parse("2026-11-09T12:00:00Z");
    await buy(api, "premium-gems-small", "tx-older");
    clock = Date.parse("2026-11-10T08:30:00Z");
    await buy(api, "premium-gems-large", "tx-newer");
    const { entries } = await api.getPurchaseHistory();
    expect(entries.map(entry => entry.productId)).toEqual(["premium-gems-large", "premium-gems-small"]);
    expect(entries[0].purchasedAt).toBe("2026-11-10T08:30:00.000Z");
    expect(entries[0].transactionTail).toBe("••••ewer");
    expect(entries[1].firstBonusApplied).toBe(true);
    expect(entries[1].granted.some(grant => grant.kind === "currency" && grant.currency === "gems")).toBe(true);
  });

  it("지급 시각이 새겨지기 전의 거래는 검증 시각으로 채우고, 둘 다 없으면 시각 없이 맨 뒤에 둔다", () => {
    const entries = purchaseHistoryFromJournal({ raidAdmissions: {}, receipts: {
      [JSON.stringify(["platformTransaction", "old-1"])]: { identity: "premium-gems-small", result: { productId: "premium-gems-small", granted: [], firstBonusApplied: false } },
      [JSON.stringify(["platformTransaction", "old-2"])]: { identity: "premium-gems-small", result: { productId: "premium-gems-small", granted: [], firstBonusApplied: false } },
      [JSON.stringify(["platformVerification", "verification-old-2"])]: { identity: "premium-gems-small", result: { transactionId: "old-2", serverTime: "2026-10-01T00:00:00.000Z" } },
      [JSON.stringify(["mail", "m1"])]: { identity: "x", result: {} },
    } });
    expect(entries.map(entry => [entry.transactionTail, entry.purchasedAt])).toEqual([["••••old2", "2026-10-01T00:00:00.000Z"], ["••••old1", null]]);
  });
});

describe("선물 기록", () => {
  it("우편으로 받은 보상이 제목·보낸 이·받은 시각과 함께 남고, 같은 요청을 다시 보내도 두 번 적히지 않는다", async () => {
    const { api } = server();
    clock = Date.parse("2026-11-12T03:00:00Z");
    api.attachOpsMails([
      { id: "g1", title: "점검 보상", body: "", rewards: [{ asset: "gems", amount: 300 }], sentAt: "2026-11-11T00:00:00Z", expiresAt: null },
      { id: "g2", title: "쿠폰 선물", body: "", rewards: [{ asset: "gold", amount: 5000 }], sentAt: "2026-11-11T00:00:00Z", expiresAt: null },
    ]);
    expect((await api.getPurchaseHistory()).gifts).toEqual([]);
    const { mails } = await api.getMails();
    const ids = mails.filter(mail => mail.id.startsWith("ops:g")).map(mail => mail.id);
    await api.claimMailRewards({ mailIds: ids, requestId: "gift-claim" });
    await api.claimMailRewards({ mailIds: ids, requestId: "gift-claim" });
    const { gifts } = await api.getPurchaseHistory();
    expect(gifts.map(gift => gift.title).sort()).toEqual(["점검 보상", "쿠폰 선물"]);
    expect(gifts.every(gift => gift.receivedAt === "2026-11-12T03:00:00.000Z" && gift.sender.length > 0)).toBe(true);
    expect(gifts.find(gift => gift.title === "점검 보상")!.rewards).toEqual([{ kind: "currency", currency: "gems", amount: 300 }]);
  });

  it("장부는 최근 것부터 상한까지만 남고 저장 검증을 통과한다", () => {
    let journal = emptyServerJournal();
    for (let index = 0; index < GIFT_LOG_LIMIT + 5; index += 1) {
      journal = appendGiftLog(journal, [{ title: `선물 ${index}`, sender: "운영", receivedAt: new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString(), rewards: [{ kind: "currency", currency: "gems", amount: 10 }] }]);
    }
    const gifts = giftHistoryFromJournal(journal);
    expect(gifts).toHaveLength(GIFT_LOG_LIMIT);
    expect(gifts[0].title).toBe(`선물 ${GIFT_LOG_LIMIT + 4}`);
    expect(isValidServerJournal(journal)).toBe(true);
    expect(isValidServerJournal({ ...journal, giftLog: [{ title: 1 }] })).toBe(false);
  });
});

describe("구매 복원", () => {
  it("결제 SDK가 없으면 성공을 흉내 내지 않는다", async () => {
    const { api } = server();
    expect(await runPlatformRestore(api, new UnsupportedPlatformPaymentAdapter(), PRODUCTS)).toEqual({ status: "unsupported" });
    expect(await runPlatformRestore(api, { requestPayment: async () => ({ status: "cancelled" }) }, PRODUCTS)).toEqual({ status: "unsupported" });
  });

  it("지급을 못 받은 거래만 새로 지급하고, 이미 받은 거래는 다시 주지 않는다", async () => {
    const { state, api } = server();
    await buy(api, "premium-gems-small", "tx-paid");
    const gems = state.wallet.gems;
    const outcome = await runPlatformRestore(api, store([receipt("premium-gems-small", "tx-paid"), receipt("premium-gems-large", "tx-lost")]), PRODUCTS);
    expect(outcome).toMatchObject({ status: "restored", restored: 1, checked: 2 });
    expect(state.wallet.gems).toBeGreaterThan(gems);
    const after = state.wallet.gems;
    expect(await runPlatformRestore(api, store([receipt("premium-gems-large", "tx-lost")]), PRODUCTS)).toMatchObject({ status: "restored", restored: 0, checked: 1 });
    expect(state.wallet.gems).toBe(after);
    expect((await api.getPurchaseHistory()).entries).toHaveLength(2);
  });

  it("스토어에 남은 거래가 없으면 복원할 것이 없다고 끝난다", async () => {
    const { api } = server();
    expect(await runPlatformRestore(api, store([]), PRODUCTS)).toEqual({ status: "restored", restored: 0, checked: 0, granted: [] });
  });

  it("알 수 없는 상품의 영수증만 돌아오면 실패로 알린다", async () => {
    const { api } = server();
    const outcome = await runPlatformRestore(api, store([{ platform: "test", productId: "unknown", transactionId: "tx", payload: "p" }]), PRODUCTS);
    expect(outcome.status).toBe("failed");
  });
});
