import type { GiftOrder, GiftRecipientFacts, GiftSenderFacts, GiftStatus } from "../core/gifting";

/**
 * 선물 주문은 두 계정 사이에 걸리므로 저장(`Session`)에 넣지 않고 DB 표(`gift_orders`)가 갖는다.
 *
 * 게임 호출 한 번은 「맥락을 읽고 → 규칙을 돌리고 → 상태와 주문 변경을 한 트랜잭션으로 확정」한다 — 결투 방어 기록과 같은
 * 모양이다(`playerDuels.ts`). 받는 사람의 지급은 받는 사람이 직접 부른 `acceptGift`가 **자기 저장**에 하므로, 다른 계정의
 * 저장을 고치는 일은 없다. 보낸 사람의 채무·차단은 스토어 환불 함수(`server_apply_store_refund`)가 DB에서만 세운다.
 */
export interface GiftContext {
  playerId: string;
  /** 보낸 사람으로서의 사실 중 저장이 모르는 것(게스트·미성년·차단·결제/환불 이력). 레벨·가입일은 저장에서 읽는다. */
  sender: Omit<GiftSenderFacts, "researchLevel" | "accountCreatedAt">;
  /** 친구 관계에 있는 받을 수 있는 사람들. 이름은 표시용이다. */
  recipients: Record<string, GiftRecipientFacts & { name: string }>;
  /** 내가 보내거나 받은 주문, 그리고 받는 쪽 한도를 재는 데 필요한 주문(지난 31일 이상). */
  orders: GiftOrder[];
  /** 이번 호출이 만든 주문 변경. 저장과 함께 확정하고, 다른 호출이 그 사이 바꿨으면 충돌로 다시 시도한다. */
  changes: GiftChange[];
}

/** `expectedStatus`가 `null`이면 새 주문이다. 아니면 DB의 그 주문이 아직 그 상태일 때만 바꾼다. */
export interface GiftChange { expectedStatus: GiftStatus | null; order: GiftOrder; }

/** 맥락의 주문 목록에 변경을 반영하고 변경 장부에 남긴다. 같은 주문을 한 호출에서 두 번 바꾸면 처음 기대 상태를 지킨다. */
export function recordGiftChange(context: GiftContext, expectedStatus: GiftStatus | null, order: GiftOrder): void {
  const existing = context.changes.find(change => change.order.id === order.id);
  if (existing) existing.order = order;
  else context.changes.push({ expectedStatus, order });
  const index = context.orders.findIndex(row => row.id === order.id);
  if (index >= 0) context.orders[index] = order;
  else context.orders.push(order);
}
