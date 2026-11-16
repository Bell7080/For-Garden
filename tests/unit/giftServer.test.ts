import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import type { GiftContext } from "../../src/server/playerGifts";
import { createDefaultSession } from "../../src/state/session";

/**
 * 선물하기 서버 경계 — 스위치가 꺼진 동안 모두 거절하고, 켰을 때(테스트 전용 `giftingOverride`) 보내기·받기·거절·취소가
 * 규칙대로 흐르는지, 보낸 사람에게는 아무것도 지급되지 않는지 본다. 실서버에서는 맥락을 DB가 주입하고 주문 변경을
 * `server_commit_state`가 확정한다(`supabase/migrations/20261127000000_gifting.sql`).
 */
const DAY = 86_400_000;
let clock = Date.parse("2026-11-20T12:00:00Z");
const ago = (days: number): string => new Date(clock - days * DAY).toISOString();
const PRODUCT = "premium-gems-small";
const OPEN = { enabled: true, giftableProductIds: [PRODUCT] } as const;

function context(playerId: string, friend: string, friendName: string, orders: GiftContext["orders"] = []): GiftContext {
  return {
    playerId,
    sender: { guest: false, ageRestricted: false, blocked: false, oldestClearedOwnPaymentAt: ago(30), lastOwnRefundAt: null },
    recipients: { [friend]: { id: friend, name: friendName, friendSince: ago(30), active: true, guest: false } },
    orders, changes: [],
  };
}

function server(giftContext: GiftContext | undefined, override: { enabled: boolean; giftableProductIds: readonly string[] } | null = OPEN) {
  const state = createDefaultSession();
  state.playerResearch.level = 30;
  state.playerCard.createdAt = ago(60);
  state.playerCard.nickname = giftContext?.playerId === "a" ? "보낸이" : "받는이";
  const api = new FakeServer(state, { latencyMs: 0, now: () => new Date(clock), persistSession: () => undefined, giftContext, giftingOverride: override ?? undefined });
  return { state, api };
}

async function pay(api: FakeServer, orderId: string, tx: string) {
  const verified = await api.verifyPurchaseReceipt({ productId: PRODUCT, platform: "test", receipt: `verified-receipt:${PRODUCT}:${tx}`, requestId: `verify-${tx}` });
  return api.sendGift({ orderId, verificationId: verified.verificationId, requestId: `send-${tx}` });
}

const code = async (run: Promise<unknown>): Promise<string> => run.then(() => "ok", (error: unknown) => error instanceof GameApiError ? error.code : String(error));

describe("선물하기 서버 경계", () => {
  it("스위치가 꺼져 있으면 모든 선물 호출이 GIFT_UNAVAILABLE이고 결제 기록에도 선물이 서지 않는다", async () => {
    const { api } = server(context("a", "b", "B"), null);
    expect(await code(api.getGiftOptions({ recipientId: "b" }))).toBe("GIFT_UNAVAILABLE");
    expect(await code(api.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "r1" }))).toBe("GIFT_UNAVAILABLE");
    expect(await code(api.getIncomingGifts())).toBe("GIFT_UNAVAILABLE");
    expect(await code(api.acceptGift({ orderId: "x", requestId: "y" }))).toBe("GIFT_UNAVAILABLE");
    expect((await api.getPurchaseHistory()).sentGifts).toEqual([]);
  });

  it("맥락이 주입되지 않은 서버도 선물을 열지 않는다", async () => {
    const { api } = server(undefined);
    expect(await code(api.getGiftOptions({ recipientId: "b" }))).toBe("GIFT_UNAVAILABLE");
  });

  it("보내기 → 받기: 받는 사람의 저장에만 지급되고 보낸 사람의 지갑은 그대로다", async () => {
    const senderContext = context("a", "b", "B");
    const { api: sender, state: senderState } = server(senderContext);
    const options = await sender.getGiftOptions({ recipientId: "b" });
    expect(options.options.find(option => option.productId === PRODUCT)).toMatchObject({ eligible: true, reason: null });

    const gemsBefore = senderState.wallet.gems;
    const prepared = await sender.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "p1" });
    // 같은 요청을 다시 보내도 같은 주문이다.
    expect((await sender.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "p1" })).orderId).toBe(prepared.orderId);
    const sent = await pay(sender, prepared.orderId, "tx-1");
    expect(sent.gift.status).toBe("pending");
    expect(senderState.wallet.gems).toBe(gemsBefore);
    expect(senderContext.changes.map(change => [change.expectedStatus, change.order.status])).toEqual([[null, "pending"]]);
    // 같은 거래 영수증으로 일반 지급을 받아 가지 못한다 — 선물 영수증이 되돌아올 뿐 지급은 비어 있다.
    const replay = await sender.fulfillPlatformPurchase({ verificationId: "verification-tx-1", requestId: "f1" });
    expect(replay).toMatchObject({ replayed: true, granted: [] });
    expect(senderState.wallet.gems).toBe(gemsBefore);
    expect((await sender.getPurchaseHistory()).entries).toEqual([]);
    expect((await sender.getPurchaseHistory()).sentGifts.map(row => row.status)).toEqual(["pending"]);

    const recipientContext = context("b", "a", "A", senderContext.orders.map(order => ({ ...order })));
    const { api: recipient, state: recipientState } = server(recipientContext);
    const inbox = await recipient.getIncomingGifts();
    expect(inbox.gifts.map(gift => gift.orderId)).toEqual([prepared.orderId]);
    const recipientGems = recipientState.wallet.gems;
    const accepted = await recipient.acceptGift({ orderId: prepared.orderId, requestId: "a1" });
    expect(accepted.wallet.gems).toBeGreaterThan(recipientGems);
    expect(recipientContext.changes.map(change => [change.expectedStatus, change.order.status])).toEqual([["pending", "accepted"]]);
    expect((await recipient.getIncomingGifts()).gifts).toEqual([]);
    // 받은 선물은 보낸 사람이 거둘 수 없다.
    const after = context("a", "b", "B", recipientContext.orders.map(order => ({ ...order })));
    expect(await code(server(after).api.cancelGift({ orderId: prepared.orderId, requestId: "c1" }))).toBe("GIFT_STATE_INVALID");
  });

  it("거절과 취소는 주문을 되돌리고, 맞지 않는 쪽의 조작은 막는다", async () => {
    const senderContext = context("a", "b", "B");
    const { api: sender } = server(senderContext);
    const first = await sender.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "p1" });
    await pay(sender, first.orderId, "tx-1");
    // 받는 사람이 아닌 보낸 사람은 받을 수 없다.
    expect(await code(sender.acceptGift({ orderId: first.orderId, requestId: "a0" }))).toBe("GIFT_NOT_FOUND");
    expect((await sender.cancelGift({ orderId: first.orderId, requestId: "c1" })).gift.status).toBe("returned");

    const second = await sender.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "p2" });
    await pay(sender, second.orderId, "tx-2");
    const recipientContext = context("b", "a", "A", senderContext.orders.map(order => ({ ...order })));
    const { api: recipient, state: recipientState } = server(recipientContext);
    const gemsBefore = recipientState.wallet.gems;
    expect(await code(recipient.cancelGift({ orderId: second.orderId, requestId: "c2" }))).toBe("GIFT_NOT_FOUND");
    await recipient.declineGift({ orderId: second.orderId, requestId: "d1" });
    expect(recipientState.wallet.gems).toBe(gemsBefore);
    expect(recipientContext.orders.find(order => order.id === second.orderId)).toMatchObject({ status: "returned", returnReason: "declined" });
  });

  it("자격이 없으면 주문이 서지 않는다 — 친구가 된 지 얼마 안 됐거나 보낸 사람이 막혔을 때", async () => {
    const fresh = context("a", "b", "B");
    fresh.recipients.b.friendSince = ago(2);
    const { api } = server(fresh);
    expect((await api.getGiftOptions({ recipientId: "b" })).options.find(option => option.productId === PRODUCT)).toMatchObject({ eligible: false, reason: "friend_too_new" });
    expect(await code(api.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "p1" }))).toBe("GIFT_NOT_ELIGIBLE");
    expect(fresh.changes).toEqual([]);

    const blocked = context("a", "b", "B");
    blocked.sender.blocked = true;
    expect(await code(server(blocked).api.prepareGift({ recipientId: "b", productId: PRODUCT, requestId: "p2" }))).toBe("GIFT_NOT_ELIGIBLE");
  });

  it("한정·주기 상품은 선물 목록에 올려도 서지 않는다 — 부계정이 한도를 비껴가지 못하게", async () => {
    const limited = ["premium-starter", "premium-daily-deal", "premium-weekly-deal", "premium-monthly-fossil", "premium-monthly", "premium-season-pass"];
    const { api } = server(context("a", "b", "B"), { enabled: true, giftableProductIds: [PRODUCT, ...limited] });
    expect((await api.getGiftOptions({ recipientId: "b" })).options.map(option => option.productId)).toEqual([PRODUCT]);
    expect(await code(api.prepareGift({ recipientId: "b", productId: "premium-starter", requestId: "p1" }))).not.toBe("ok");
  });

  it("선물 가능으로 표시되지 않은 상품은 선물 목록에 서지 않는다", async () => {
    const { api } = server(context("a", "b", "B"), { enabled: true, giftableProductIds: [] });
    expect((await api.getGiftOptions({ recipientId: "b" })).options).toEqual([]);
  });
});
