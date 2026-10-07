/**
 * 유료 상품 지급 수량의 깔끔한 단위 — 1~9 아무 정수, 10~99 5단위, 100~999 50단위, 1,000~9,999 500단위,
 * 10,000~99,999 5,000단위, 100,000 이상 50,000단위. 단위에 안 맞으면 깎지 않고 올림해 조금 더 얹는다.
 */
export function paidAmountUnit(amount: number): number {
  if (amount < 10) return 1;
  if (amount < 100) return 5;
  if (amount < 1_000) return 50;
  if (amount < 10_000) return 500;
  if (amount < 100_000) return 5_000;
  return 50_000;
}

/** 수량이 단위에 맞는가. */
export function isCleanPaidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount % paidAmountUnit(amount) === 0;
}
