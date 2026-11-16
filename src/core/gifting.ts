/**
 * 선물하기 — 친구에게 유료 상품을 사서 보내는 규칙(설계 `/mnt/project-files/gift-system/gift-system-design.md`).
 *
 * **지금은 꺼져 있다**(`GIFTING_ENABLED` — 응태 결정 2026-11-16: 「구현은 하되 결제처럼 지금은 안 되게」). 결제가 SDK 없이
 * `unsupported`를 돌려주는 것과 같이, 꺼진 동안 서버의 모든 선물 경계는 `GIFT_UNAVAILABLE`로 거절하고 화면은 입구를 세우지
 * 않는다. **켜기 전 선행 조건은 스토어 환불 자동 수신**(Apple App Store Server Notifications V2 · Google RTDN)이다 — 환불을 모르는
 * 채 선물을 열면 좀비고 사태와 같은 조건이 된다(결정 D6).
 *
 * 핵심 약속 둘:
 * 1. **받는 사람은 절대 음수가 되지 않는다.** 받은 뒤 환불이 와도 받는 쪽에서 아무것도 회수하지 않는다(`giftRefundOutcome`).
 * 2. **책임은 보낸 사람이 진다** — 채무 장부 · 선물 영구 차단 · 결제 보류(운영 검토 뒤 해제).
 *
 * 수치는 설계안의 추천값(D1~D7)이다. 바꿀 때는 값만 고치고 `gifting.test`를 함께 고친다(응태 승인).
 * Phaser를 읽지 않는 순수 모듈이라 FakeServer·서버 핸들러·화면이 같은 판정을 읽는다.
 */

/** 선물하기 스위치. 켜는 것은 응태 결정이고, 켜기 전에 스토어 환불 자동 수신이 먼저 서야 한다. */
export const GIFTING_ENABLED = false;

const DAY_MS = 86_400_000;

/** 결정 D2·D4의 추천값. */
export const GIFT_POLICY = {
  /** 보낸 사람 연구원 레벨. 막 만든 부계정을 걸러 낸다. */
  senderMinResearchLevel: 20,
  /** 보낸 사람 계정 나이(일). */
  senderMinAccountDays: 14,
  /** 친구가 된 뒤 지나야 하는 날. 끊었다 다시 맺으면 처음부터 센다. */
  minFriendDays: 14,
  /** 본인 결제가 이 날수만큼 환불 없이 지나야 선물할 수 있다. */
  ownPaymentClearDays: 7,
  /** 이 기간 안에 본인 결제 환불이 있으면 선물할 수 없다. */
  refundLookbackDays: 90,
  sendPerDay: 2,
  sendPer30Days: 10,
  /**
   * 금액 한도는 고정 숫자가 아니라 **본인 결제 실적**이다(응태 결정 2026-11-16 — 최대 한도를 두지 않는다). 이 기간 동안
   * 보낸 선물의 원화 합은 같은 기간에 환불 없이 `ownPaymentClearDays`가 지난 본인 결제(선물 결제 제외)의 원화 합을 넘지 못한다.
   * 오래 결제해 온 사람은 사실상 한도가 없고, 막 만든 계정·도용 카드 계정은 0원부터다 — 도용 카드로 선물을 사서 판매용
   * 계정에 몰아주는 세탁을 막는다(받은 쪽은 회수하지 않으므로 선물이 일반 결제보다 세탁에 좋은 통로가 된다).
   */
  amountWindowDays: 90,
  receivePerDay: 2,
  receivePer30Days: 10,
  /** 받지 않은 선물이 돌아오기까지(일). */
  pendingExpiryDays: 30,
  /** 결제 대기 주문이 사라지기까지(분). */
  paymentWindowMinutes: 30,
  /**
   * 선물로 보낼 수 있는 상품의 계정당 구매 한도 하한. 한정·주기 상품(한도 1~2, 매일·매주·매달·계정당 한 번)은
   * 부계정이 선물로 몇 번이고 사 줄 수 있어 「한 사람에 한 번」이라는 값어치가 깨진다 — 되풀이해 사는 팩만 연다.
   */
  minGiftablePurchaseLimit: 10,
} as const;

/** 선물 가능 여부를 가르는 상품의 모양. `ProductDefinition`을 그대로 넘겨도 된다. */
export interface GiftableProductShape {
  acquisition: { kind: string };
  purchaseLimit: number;
  refresh: string;
  passBenefit?: unknown;
  situational?: unknown;
}

/**
 * 선물로 보내도 내가 사는 것보다 이득이 생기지 않는 상품인가.
 *
 * 선물은 상품의 기본 지급(`grants`)만 주고 첫 구매 보너스·계정 첫 결제 보상은 주지 않으므로 같은 값이면 언제나
 * 직접 사는 쪽이 같거나 낫다. 남는 구멍은 한도다 — 받는 사람의 구매 기록을 세지 않으니 한정 상품을 선물로
 * 되풀이해 받으면 한도를 비껴간다. 그래서 주기가 없고(`refresh: "none"`) 한도가 넉넉한 상품만 연다.
 * `giftable` 표시나 테스트 목록이 있어도 이 모양을 지나야 한다.
 */
export function giftableProductShape(product: GiftableProductShape): boolean {
  return product.acquisition.kind === "platform_payment"
    && !product.passBenefit
    && !product.situational
    && product.refresh === "none"
    && product.purchaseLimit >= GIFT_POLICY.minGiftablePurchaseLimit;
}

/**
 * 주문 상태.
 *
 * - `awaiting_payment` 결제 대기 — 주문 ID가 스토어 토큰으로 들어가 결제와 묶인다.
 * - `pending` 수령 대기 — 받는 사람 우편함에 서 있고 아직 아무것도 지급하지 않았다.
 * - `accepted` 받음 — 받는 사람이 받은 순간 그 계정 저장에 지급됐다.
 * - `returned` 돌아옴 — 거절·기한 만료·보낸 사람 취소. 보낸 사람에게 상품을 주지 않고 스토어 환불로 돌린다(결정 D3).
 * - `revoked` 회수됨 — 수령 전에 스토어 환불이 왔다. 받는 쪽에 간 것이 없다.
 * - `lapsed` 소멸 — 결제가 끝내 오지 않은 주문. 화면에 서지 않는다.
 */
export type GiftStatus = "awaiting_payment" | "pending" | "accepted" | "returned" | "revoked" | "lapsed";
export type GiftReturnReason = "declined" | "expired" | "cancelled";

export interface GiftOrder {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  productId: string;
  /** 주문 시점의 원화 값. 금액 한도와 채무가 이 값을 읽는다. */
  priceKrw: number;
  status: GiftStatus;
  createdAt: string;
  /** 결제가 확인된 시각(수령 대기가 된 순간). */
  paidAt: string | null;
  /** 결제 대기면 결제 마감, 수령 대기면 돌아오는 시각. */
  expiresAt: string;
  resolvedAt: string | null;
  transactionId: string | null;
  returnReason: GiftReturnReason | null;
  /** 받은 뒤 스토어 환불이 온 시각. 받는 쪽은 그대로이고 보낸 쪽에 채무가 선다. */
  refundedAt: string | null;
}

/** 보낸 사람에 관해 서버(DB)가 아는 사실. 화면이 보내지 않는다. */
export interface GiftSenderFacts {
  researchLevel: number;
  accountCreatedAt: string | null;
  /** 게스트(익명) 계정. 버리고 새로 만들기 쉬워 보낼 수 없다. */
  guest: boolean;
  /** 법정대리인 동의 흐름이 서기 전의 미성년 계정(결정 D7). */
  ageRestricted: boolean;
  /** 받은 뒤 환불로 영구 차단된 계정. */
  blocked: boolean;
  /** 환불되지 않은 본인 결제 중 가장 오래된 것의 시각. 없으면 `null`. 선물 결제는 세지 않는다. */
  oldestClearedOwnPaymentAt: string | null;
  /** 가장 최근의 본인 결제 환불 시각. */
  lastOwnRefundAt: string | null;
  /** 지난 `amountWindowDays` 안의 환불되지 않은 본인 결제(선물 결제 제외) — 원화 값과 지급 시각. 금액 한도가 읽는다. */
  ownPayments: readonly { priceKrw: number; at: string }[];
  /** 보낸 사람의 스토어 지역(ISO 3166-1 alpha-2). 모르면 `null`이고 보낼 수 없다. */
  storeRegion: string | null;
}

export interface GiftRecipientFacts {
  id: string;
  /** 지금의 친구 관계가 맺어진 시각. 친구가 아니면 `null`. */
  friendSince: string | null;
  /** 같은 길드에 함께 있은 시각(둘 중 늦게 들어온 쪽). 같은 길드가 아니면 `null`. 친구가 아니어도 길드원이면 받을 수 있다. */
  guildmateSince?: string | null;
  /** 정상 활동 중인 계정인가(정지·탈퇴·게스트 포기 아님). */
  active: boolean;
  guest: boolean;
  /** 받는 사람의 스토어 지역. 보낸 사람과 같아야 한다 — 싼 지역에서 사서 비싼 지역에 보내는 가격 차익을 막는다. */
  storeRegion: string | null;
}

export type GiftRefusal =
  | "disabled" | "not_giftable" | "self"
  | "level" | "account_age" | "guest" | "age_restricted" | "blocked" | "no_payment_history" | "recent_refund"
  | "not_friend" | "friend_too_new" | "recipient_unavailable"
  | "region_mismatch" | "send_daily" | "send_monthly" | "send_amount" | "receive_daily" | "receive_monthly" | "duplicate_pending";

export type GiftEligibility = { ok: true } | { ok: false; reason: GiftRefusal };

export interface GiftEligibilityInput {
  enabled: boolean;
  senderId: string;
  sender: GiftSenderFacts;
  recipient: GiftRecipientFacts | null;
  productId: string;
  priceKrw: number;
  giftable: boolean;
  /** 보낸 사람이 보낸 주문과 받는 사람이 받은 주문(지난 30일 이상). 중복은 상관없다. */
  orders: readonly GiftOrder[];
  now: Date;
}

const ms = (iso: string | null): number => iso ? Date.parse(iso) : NaN;
const olderThan = (iso: string | null, days: number, now: Date): boolean => Number.isFinite(ms(iso)) && now.getTime() - ms(iso) >= days * DAY_MS;
const within = (iso: string, days: number, now: Date): boolean => now.getTime() - ms(iso) < days * DAY_MS;

/** 한도에 세는 주문 — 결제가 끝났거나 결제 중인 것. 사라진 결제 대기만 세지 않는다. */
export function countsTowardGiftLimits(order: GiftOrder, now: Date): boolean {
  const settled = settleGiftOrder(order, now);
  return settled.status !== "lapsed";
}

/**
 * 보낼 수 있는가. 순서는 「바꿀 수 없는 것 → 보낸 사람 → 관계 → 한도」라, 거절 사유가 지금 할 수 있는 일과 가까운 것부터 선다.
 */
export function giftEligibility(input: GiftEligibilityInput): GiftEligibility {
  const { sender, recipient, now } = input;
  const refuse = (reason: GiftRefusal): GiftEligibility => ({ ok: false, reason });
  if (!input.enabled) return refuse("disabled");
  if (!input.giftable) return refuse("not_giftable");
  if (recipient && recipient.id === input.senderId) return refuse("self");
  if (sender.guest) return refuse("guest");
  if (sender.ageRestricted) return refuse("age_restricted");
  if (sender.blocked) return refuse("blocked");
  if (sender.researchLevel < GIFT_POLICY.senderMinResearchLevel) return refuse("level");
  if (!olderThan(sender.accountCreatedAt, GIFT_POLICY.senderMinAccountDays, now)) return refuse("account_age");
  if (sender.lastOwnRefundAt && within(sender.lastOwnRefundAt, GIFT_POLICY.refundLookbackDays, now)) return refuse("recent_refund");
  if (!olderThan(sender.oldestClearedOwnPaymentAt, GIFT_POLICY.ownPaymentClearDays, now)) return refuse("no_payment_history");
  if (!recipient || !recipient.active || recipient.guest) return refuse("recipient_unavailable");
  // 관계는 친구 또는 같은 길드 — 둘 중 하나라도 맺은 지 `minFriendDays`가 지났으면 된다.
  const ties = [recipient.friendSince, recipient.guildmateSince ?? null].filter((tie): tie is string => !!tie);
  if (ties.length === 0) return refuse("not_friend");
  if (!ties.some(tie => olderThan(tie, GIFT_POLICY.minFriendDays, now))) return refuse("friend_too_new");
  if (!sender.storeRegion || sender.storeRegion !== recipient.storeRegion) return refuse("region_mismatch");

  const live = dedupe(input.orders).filter(order => countsTowardGiftLimits(order, now));
  const sent = live.filter(order => order.senderId === input.senderId);
  const received = live.filter(order => order.recipientId === recipient.id);
  if (sent.some(order => order.recipientId === recipient.id && order.productId === input.productId && ["awaiting_payment", "pending"].includes(settleGiftOrder(order, now).status))) return refuse("duplicate_pending");
  if (sent.filter(order => within(order.createdAt, 1, now)).length >= GIFT_POLICY.sendPerDay) return refuse("send_daily");
  const sentMonth = sent.filter(order => within(order.createdAt, 30, now));
  if (sentMonth.length >= GIFT_POLICY.sendPer30Days) return refuse("send_monthly");
  if (giftAmountAllowanceKrw(sender, sent, now) < input.priceKrw) return refuse("send_amount");
  // 돌아온 선물은 받은 것이 아니므로 받기 한도에 세지 않는다.
  const receivedLive = received.filter(order => settleGiftOrder(order, now).status !== "returned" && settleGiftOrder(order, now).status !== "revoked");
  if (receivedLive.filter(order => within(order.createdAt, 1, now)).length >= GIFT_POLICY.receivePerDay) return refuse("receive_daily");
  if (receivedLive.filter(order => within(order.createdAt, 30, now)).length >= GIFT_POLICY.receivePer30Days) return refuse("receive_monthly");
  return { ok: true };
}

/**
 * 지금 더 보낼 수 있는 원화 — 기간 안의 결제가 끝난 본인 결제 합에서 같은 기간에 보낸 선물 합을 뺀 값.
 * 돌아오거나 회수된 선물은 결제가 스토어로 돌아갔으니 빼지 않는다. 결제 대기 주문은 결제가 되면 쓰일 몫이라 뺀다.
 */
export function giftAmountAllowanceKrw(sender: Pick<GiftSenderFacts, "ownPayments">, sentOrders: readonly GiftOrder[], now: Date): number {
  const window = GIFT_POLICY.amountWindowDays;
  const earned = sender.ownPayments
    .filter(payment => within(payment.at, window, now) && olderThan(payment.at, GIFT_POLICY.ownPaymentClearDays, now))
    .reduce((sum, payment) => sum + payment.priceKrw, 0);
  const spent = sentOrders
    .filter(order => within(order.createdAt, window, now) && !["returned", "revoked", "lapsed"].includes(settleGiftOrder(order, now).status))
    .reduce((sum, order) => sum + order.priceKrw, 0);
  return Math.max(0, earned - spent);
}

function dedupe(orders: readonly GiftOrder[]): GiftOrder[] {
  return [...new Map(orders.map(order => [order.id, order])).values()];
}

/** 새 결제 대기 주문. 결제 마감은 `paymentWindowMinutes` 뒤다. */
export function createGiftOrder(input: { id: string; senderId: string; recipientId: string; senderName: string; recipientName: string; productId: string; priceKrw: number; now: Date }): GiftOrder {
  return {
    id: input.id, senderId: input.senderId, recipientId: input.recipientId, senderName: input.senderName, recipientName: input.recipientName,
    productId: input.productId, priceKrw: input.priceKrw, status: "awaiting_payment", createdAt: input.now.toISOString(), paidAt: null,
    expiresAt: new Date(input.now.getTime() + GIFT_POLICY.paymentWindowMinutes * 60_000).toISOString(), resolvedAt: null,
    transactionId: null, returnReason: null, refundedAt: null,
  };
}

/** 시간이 정하는 전이 — 결제가 오지 않은 주문은 사라지고, 받지 않은 선물은 돌아온다. 같은 입력이면 같은 결과다. */
export function settleGiftOrder(order: GiftOrder, now: Date): GiftOrder {
  if (now.getTime() < ms(order.expiresAt)) return order;
  if (order.status === "awaiting_payment") return { ...order, status: "lapsed", resolvedAt: order.expiresAt };
  if (order.status === "pending") return { ...order, status: "returned", returnReason: "expired", resolvedAt: order.expiresAt };
  return order;
}

export type GiftAction =
  | { kind: "pay"; transactionId: string }
  | { kind: "accept" }
  | { kind: "decline" }
  | { kind: "cancel" };

export class GiftTransitionError extends Error {
  constructor(readonly reason: "not_found" | "forbidden" | "state") { super(`GIFT_${reason.toUpperCase()}`); }
}

/**
 * 사람이 일으키는 전이. 결제·취소는 보낸 사람만, 받기·거절은 받는 사람만 한다. 시간 전이를 먼저 적용하므로
 * 기한이 지난 선물은 받을 수 없다.
 */
export function transitionGift(order: GiftOrder, action: GiftAction, actorId: string, now: Date): GiftOrder {
  const current = settleGiftOrder(order, now);
  const at = now.toISOString();
  const senderOnly = (): void => { if (actorId !== current.senderId) throw new GiftTransitionError("forbidden"); };
  const recipientOnly = (): void => { if (actorId !== current.recipientId) throw new GiftTransitionError("forbidden"); };
  switch (action.kind) {
    case "pay":
      senderOnly();
      if (current.status !== "awaiting_payment") throw new GiftTransitionError("state");
      return { ...current, status: "pending", paidAt: at, transactionId: action.transactionId, expiresAt: new Date(now.getTime() + GIFT_POLICY.pendingExpiryDays * DAY_MS).toISOString() };
    case "accept":
      recipientOnly();
      if (current.status !== "pending") throw new GiftTransitionError("state");
      return { ...current, status: "accepted", resolvedAt: at };
    case "decline":
      recipientOnly();
      if (current.status !== "pending") throw new GiftTransitionError("state");
      return { ...current, status: "returned", returnReason: "declined", resolvedAt: at };
    case "cancel":
      senderOnly();
      if (current.status !== "pending") throw new GiftTransitionError("state");
      return { ...current, status: "returned", returnReason: "cancelled", resolvedAt: at };
  }
}

/**
 * 스토어 환불이 그 선물 결제에 왔을 때.
 *
 * **받는 쪽에서 빼는 것은 어느 경우에도 없다**(`recipientClawback`는 늘 비어 있다). 받기 전이면 선물을 거두고, 받은 뒤면
 * 보낸 사람에게 채무를 세우고 선물을 영구로 막으며 결제를 보류한다. 같은 환불이 두 번 와도 두 번째는 아무것도 바꾸지 않는다.
 */
export interface GiftRefundOutcome {
  order: GiftOrder;
  recipientClawback: readonly [];
  senderDebtKrw: number;
  blockSender: boolean;
  holdSenderPayments: boolean;
}

export function giftRefundOutcome(order: GiftOrder, now: Date): GiftRefundOutcome {
  const at = now.toISOString();
  const none = (next: GiftOrder): GiftRefundOutcome => ({ order: next, recipientClawback: [], senderDebtKrw: 0, blockSender: false, holdSenderPayments: false });
  if (order.status === "awaiting_payment") return none({ ...order, status: "lapsed", resolvedAt: at });
  if (order.status === "pending") return none({ ...order, status: "revoked", resolvedAt: at, refundedAt: at });
  if (order.status === "accepted" && !order.refundedAt) {
    return { order: { ...order, refundedAt: at }, recipientClawback: [], senderDebtKrw: order.priceKrw, blockSender: true, holdSenderPayments: true };
  }
  // 돌아온 선물의 환불은 예정된 마무리다 — 환불 완료만 적는다. 이미 처리된 환불·회수·소멸은 그대로 둔다.
  if (order.status === "returned" && !order.refundedAt) return none({ ...order, refundedAt: at });
  return none(order);
}

/** 「선물 기록」 탭이 쓰는 상태. 결제 대기·소멸은 선물이 아니라 서지 않는다. */
export function sentGiftDisplayStatus(order: GiftOrder, now: Date): "pending" | "accepted" | "returned" | "revoked" | null {
  const settled = settleGiftOrder(order, now);
  if (settled.status === "awaiting_payment" || settled.status === "lapsed") return null;
  return settled.status;
}

/** 받는 사람이 우편함에서 볼 선물 — 수령 대기만. */
export function incomingGifts(orders: readonly GiftOrder[], recipientId: string, now: Date): GiftOrder[] {
  return dedupe(orders).map(order => settleGiftOrder(order, now)).filter(order => order.recipientId === recipientId && order.status === "pending")
    .sort((a, b) => ms(a.paidAt) - ms(b.paidAt));
}
