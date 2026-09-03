/** 구매 수량 계산에 필요한 서버 확정 상품의 최소 모양이다. Phaser와 상태 저장소에 의존하지 않는다. */
export interface PurchaseOffer {
  unitPrice: number;
  remaining: number;
  balance: number;
}

/** 팝업과 서버가 함께 사용하는 수량별 가격·상한 계산 결과다. */
export interface PurchaseQuote {
  quantity: number;
  totalPrice: number;
  maxQuantity: number;
  affordableQuantity: number;
  valid: boolean;
}

/** 잔액과 남은 제한 중 작은 값까지만 살 수 있으며 수량은 항상 정수 1 이상으로 정규화한다. */
export function quotePurchase(offer: PurchaseOffer, requestedQuantity: number): PurchaseQuote {
  const unitPrice = nonNegativeInteger(offer.unitPrice);
  const remaining = nonNegativeInteger(offer.remaining);
  const balance = nonNegativeInteger(offer.balance);
  // 가격이 0인 운영 상품도 잔액 나눗셈 없이 남은 제한까지 고를 수 있다.
  const affordableQuantity = unitPrice === 0 ? remaining : Math.floor(balance / unitPrice);
  const maxQuantity = Math.min(remaining, affordableQuantity);
  const normalizedRequest = Number.isFinite(requestedQuantity) ? Math.floor(requestedQuantity) : 1;
  const quantity = maxQuantity > 0 ? Math.min(Math.max(1, normalizedRequest), maxQuantity) : 1;
  return { quantity, totalPrice: unitPrice * quantity, maxQuantity, affordableQuantity, valid: maxQuantity > 0 };
}

/** 지급 수량도 구매 수량과 같은 안전한 정수 곱으로 계산해 UI와 서버의 묶음 합계를 맞춘다. */
export function totalGrantAmount(unitAmount: number, quantity: number): number {
  return nonNegativeInteger(unitAmount) * nonNegativeInteger(quantity);
}

/** 외부 숫자는 음수·소수·무한대를 구매 공식에 들이지 않는다. */
function nonNegativeInteger(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
