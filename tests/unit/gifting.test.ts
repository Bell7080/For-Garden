import { describe, expect, it } from "vitest";
import {
  GIFTING_ENABLED, GIFT_POLICY, createGiftOrder, giftEligibility, giftRefundOutcome, incomingGifts, sentGiftDisplayStatus,
  settleGiftOrder, transitionGift, GiftTransitionError, type GiftEligibilityInput, type GiftOrder,
} from "../../src/core/gifting";

const DAY = 86_400_000;
const NOW = new Date("2026-12-01T00:00:00Z");
const ago = (days: number): string => new Date(NOW.getTime() - days * DAY).toISOString();

function input(over: Partial<GiftEligibilityInput> = {}): GiftEligibilityInput {
  return {
    enabled: true, senderId: "a", productId: "gift-pack", priceKrw: 9_900, giftable: true, orders: [], now: NOW,
    sender: { researchLevel: 30, accountCreatedAt: ago(60), guest: false, ageRestricted: false, blocked: false, oldestClearedOwnPaymentAt: ago(20), lastOwnRefundAt: null },
    recipient: { id: "b", friendSince: ago(30), active: true, guest: false },
    ...over,
  };
}

function order(over: Partial<GiftOrder> = {}): GiftOrder {
  const base = createGiftOrder({ id: "o1", senderId: "a", recipientId: "b", senderName: "A", recipientName: "B", productId: "gift-pack", priceKrw: 9_900, now: NOW });
  return { ...base, ...over };
}

describe("선물하기 스위치", () => {
  it("지금은 꺼져 있다 — 켜기 전에 스토어 환불 자동 수신이 먼저다(결정 D6)", () => {
    expect(GIFTING_ENABLED).toBe(false);
    expect(giftEligibility(input({ enabled: GIFTING_ENABLED }))).toEqual({ ok: false, reason: "disabled" });
  });
});

describe("보낼 자격 (결정 D4)", () => {
  it("조건을 모두 넘으면 보낼 수 있다", () => {
    expect(giftEligibility(input())).toEqual({ ok: true });
  });
  it.each([
    ["not_giftable", { giftable: false }],
    ["self", { recipient: { id: "a", friendSince: ago(30), active: true, guest: false } }],
    ["guest", { sender: { ...input().sender, guest: true } }],
    ["age_restricted", { sender: { ...input().sender, ageRestricted: true } }],
    ["blocked", { sender: { ...input().sender, blocked: true } }],
    ["level", { sender: { ...input().sender, researchLevel: GIFT_POLICY.senderMinResearchLevel - 1 } }],
    ["account_age", { sender: { ...input().sender, accountCreatedAt: ago(GIFT_POLICY.senderMinAccountDays - 1) } }],
    ["recent_refund", { sender: { ...input().sender, lastOwnRefundAt: ago(GIFT_POLICY.refundLookbackDays - 1) } }],
    ["no_payment_history", { sender: { ...input().sender, oldestClearedOwnPaymentAt: null } }],
    ["no_payment_history", { sender: { ...input().sender, oldestClearedOwnPaymentAt: ago(GIFT_POLICY.ownPaymentClearDays - 1) } }],
    ["recipient_unavailable", { recipient: { id: "b", friendSince: ago(30), active: false, guest: false } }],
    ["recipient_unavailable", { recipient: { id: "b", friendSince: ago(30), active: true, guest: true } }],
    ["not_friend", { recipient: { id: "b", friendSince: null, active: true, guest: false } }],
    ["friend_too_new", { recipient: { id: "b", friendSince: ago(GIFT_POLICY.minFriendDays - 1) , active: true, guest: false } }],
  ] as const)("%s", (reason, over) => {
    expect(giftEligibility(input(over as Partial<GiftEligibilityInput>))).toEqual({ ok: false, reason });
  });
  it("90일보다 오래된 환불은 막지 않는다", () => {
    expect(giftEligibility(input({ sender: { ...input().sender, lastOwnRefundAt: ago(GIFT_POLICY.refundLookbackDays + 1) } }))).toEqual({ ok: true });
  });
});

describe("한도", () => {
  const paid = (id: string, days: number, over: Partial<GiftOrder> = {}): GiftOrder => ({ ...order({ id, createdAt: ago(days), paidAt: ago(days), status: "accepted", expiresAt: ago(days - 30) }), ...over });
  it("하루 2건", () => {
    const orders = [paid("x", 0.1, { recipientId: "c" }), paid("y", 0.2, { recipientId: "d" })];
    expect(giftEligibility(input({ orders }))).toEqual({ ok: false, reason: "send_daily" });
  });
  it("30일 10건", () => {
    const orders = Array.from({ length: 10 }, (_, i) => paid(`m${i}`, 2 + i, { recipientId: `r${i}`, priceKrw: 1_000 }));
    expect(giftEligibility(input({ orders }))).toEqual({ ok: false, reason: "send_monthly" });
  });
  it("30일 금액 상한", () => {
    const orders = [paid("big", 3, { recipientId: "c", priceKrw: GIFT_POLICY.sendAmountPer30DaysKrw - 5_000 })];
    expect(giftEligibility(input({ orders }))).toEqual({ ok: false, reason: "send_amount" });
  });
  it("받는 쪽 하루 2건 — 다른 사람이 보낸 것도 센다", () => {
    const orders = [paid("p", 0.1, { senderId: "x" }), paid("q", 0.2, { senderId: "y" })];
    expect(giftEligibility(input({ orders }))).toEqual({ ok: false, reason: "receive_daily" });
  });
  it("돌아온 선물은 받기 한도에 세지 않는다", () => {
    const orders = [paid("p", 0.1, { senderId: "x", status: "returned" }), paid("q", 0.2, { senderId: "y", status: "returned" })];
    expect(giftEligibility(input({ orders }))).toEqual({ ok: true });
  });
  it("사라진 결제 대기는 세지 않는다", () => {
    const lapsed = order({ id: "l1", createdAt: ago(0.5), expiresAt: ago(0.4), recipientId: "c" });
    const lapsed2 = order({ id: "l2", createdAt: ago(0.5), expiresAt: ago(0.4), recipientId: "d" });
    expect(giftEligibility(input({ orders: [lapsed, lapsed2] }))).toEqual({ ok: true });
  });
  it("받지 않은 같은 선물이 있으면 또 보내지 못한다", () => {
    const waiting = order({ id: "w", createdAt: ago(3), status: "pending", paidAt: ago(3), expiresAt: new Date(NOW.getTime() + 20 * DAY).toISOString() });
    expect(giftEligibility(input({ orders: [waiting] }))).toEqual({ ok: false, reason: "duplicate_pending" });
  });
});

describe("상태 전이", () => {
  it("결제 → 수령 대기 → 받음", () => {
    const paidOrder = transitionGift(order(), { kind: "pay", transactionId: "tx" }, "a", NOW);
    expect(paidOrder.status).toBe("pending");
    expect(Date.parse(paidOrder.expiresAt) - NOW.getTime()).toBe(GIFT_POLICY.pendingExpiryDays * DAY);
    expect(transitionGift(paidOrder, { kind: "accept" }, "b", NOW).status).toBe("accepted");
  });
  it("결제·취소는 보낸 사람만, 받기·거절은 받는 사람만", () => {
    expect(() => transitionGift(order(), { kind: "pay", transactionId: "tx" }, "b", NOW)).toThrow(GiftTransitionError);
    const paidOrder = transitionGift(order(), { kind: "pay", transactionId: "tx" }, "a", NOW);
    expect(() => transitionGift(paidOrder, { kind: "accept" }, "a", NOW)).toThrow(GiftTransitionError);
    expect(() => transitionGift(paidOrder, { kind: "cancel" }, "b", NOW)).toThrow(GiftTransitionError);
    expect(transitionGift(paidOrder, { kind: "decline" }, "b", NOW)).toMatchObject({ status: "returned", returnReason: "declined" });
    expect(transitionGift(paidOrder, { kind: "cancel" }, "a", NOW)).toMatchObject({ status: "returned", returnReason: "cancelled" });
  });
  it("받은 선물은 취소할 수 없다", () => {
    const accepted = transitionGift(transitionGift(order(), { kind: "pay", transactionId: "tx" }, "a", NOW), { kind: "accept" }, "b", NOW);
    expect(() => transitionGift(accepted, { kind: "cancel" }, "a", NOW)).toThrow(GiftTransitionError);
  });
  it("30분 안에 결제가 오지 않으면 사라지고, 30일 안에 받지 않으면 돌아온다", () => {
    const late = new Date(NOW.getTime() + (GIFT_POLICY.paymentWindowMinutes + 1) * 60_000);
    expect(settleGiftOrder(order(), late).status).toBe("lapsed");
    expect(() => transitionGift(order(), { kind: "pay", transactionId: "tx" }, "a", late)).toThrow(GiftTransitionError);
    const paidOrder = transitionGift(order(), { kind: "pay", transactionId: "tx" }, "a", NOW);
    const expired = new Date(NOW.getTime() + GIFT_POLICY.pendingExpiryDays * DAY);
    expect(settleGiftOrder(paidOrder, expired)).toMatchObject({ status: "returned", returnReason: "expired" });
    expect(() => transitionGift(paidOrder, { kind: "accept" }, "b", expired)).toThrow(GiftTransitionError);
  });
});

describe("환불 — 받는 쪽은 절대 음수가 되지 않는다", () => {
  const paidOrder = transitionGift(order(), { kind: "pay", transactionId: "tx" }, "a", NOW);
  it("받기 전 환불은 선물을 거두고 아무도 벌하지 않는다", () => {
    const outcome = giftRefundOutcome(paidOrder, NOW);
    expect(outcome.order.status).toBe("revoked");
    expect(outcome).toMatchObject({ recipientClawback: [], senderDebtKrw: 0, blockSender: false });
  });
  it("받은 뒤 환불은 보낸 사람에게 채무·차단·결제 보류를 세우고 받는 쪽은 그대로다", () => {
    const accepted = transitionGift(paidOrder, { kind: "accept" }, "b", NOW);
    const outcome = giftRefundOutcome(accepted, NOW);
    expect(outcome.order.status).toBe("accepted");
    expect(outcome).toMatchObject({ recipientClawback: [], senderDebtKrw: 9_900, blockSender: true, holdSenderPayments: true });
    // 같은 환불이 두 번 와도 채무가 두 번 서지 않는다.
    expect(giftRefundOutcome(outcome.order, NOW)).toMatchObject({ senderDebtKrw: 0, blockSender: false });
  });
  it("모든 상태에서 받는 쪽 회수는 비어 있다", () => {
    for (const status of ["awaiting_payment", "pending", "accepted", "returned", "revoked", "lapsed"] as const) {
      expect(giftRefundOutcome(order({ status }), NOW).recipientClawback).toEqual([]);
    }
  });
});

describe("화면이 읽는 목록", () => {
  it("결제 대기·소멸은 선물 기록에 서지 않는다", () => {
    expect(sentGiftDisplayStatus(order(), NOW)).toBeNull();
    expect(sentGiftDisplayStatus(order({ status: "pending", expiresAt: new Date(NOW.getTime() + DAY).toISOString() }), NOW)).toBe("pending");
  });
  it("받은 선물함에는 내게 온 수령 대기만 선다", () => {
    const mine = order({ id: "m", status: "pending", paidAt: ago(1), expiresAt: new Date(NOW.getTime() + DAY).toISOString() });
    const other = { ...mine, id: "n", recipientId: "z" };
    const gone = { ...mine, id: "g", expiresAt: ago(0.1) };
    expect(incomingGifts([mine, other, gone], "b", NOW).map(o => o.id)).toEqual(["m"]);
  });
});
