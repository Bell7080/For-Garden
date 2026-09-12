/**
 * 교환소 한 줄의 **순수 배치표**.
 *
 * 값과 받는 것이 글자에서 **액자**로 바뀌면서 한 줄이 두꺼워졌다 — 네 줄을 58px 간격으로
 * 쌓던 예전 자리로는 액자가 서로 맞물린다. 창 높이는 손으로 적지 않고 **전시할 줄 수에서
 * 거꾸로** 구한다(무역 창과 같은 규칙이다).
 *
 * 모든 `y`는 그 줄 가운데를 0으로 잰 국소 좌표다.
 */
export const EXCHANGE_ROW = {
  /** 줄 한 장이 차지하는 높이. 아래 자리들이 이 안에 든다. */
  height: 380,
  /** 이름줄과 남은 횟수가 마주 보는 줄. */
  nameY: -140,
  /** 액자 위에 서는 작은 이름표. */
  labelY: -60,
  /** 액자 셋이 서는 줄과 한 변. */
  tagY: 6,
  tag: 84,
  /** 수량 조작과 확정이 서는 줄. */
  controlsY: 104,
  /** 결과 한 줄. 없으면 비운다. */
  messageY: 160,
  /** 줄 안에서 글과 액자가 앉는 좌·우 선. */
  left: -330,
  right: 330,
  /** 보유 → 요구 → (화살표) → 결과 액자의 중심 x. */
  ownedX: -288,
  requiredX: -160,
  arrowX: -70,
  resultX: 20,
} as const;

export const EXCHANGE = {
  width: 880,
  /** 제목표 띠와 깎인 모서리를 피해 첫 줄이 시작하기까지. */
  topPad: 140,
  bottomPad: 80,
  /** 줄 사이 여백. */
  gap: 28,
} as const;

export interface InteractionExchangeLayout {
  height: number;
  /** 줄 `count`장이 판 안에서 설 중심 y(판 가운데가 0). */
  centers: number[];
}

/** 줄 수에서 창 높이와 모든 줄 자리를 구한다. */
export function interactionExchangeLayout(count: number): InteractionExchangeLayout {
  const rows = Math.max(1, count);
  const height = EXCHANGE.topPad + rows * EXCHANGE_ROW.height + (rows - 1) * EXCHANGE.gap + EXCHANGE.bottomPad;
  const first = -height / 2 + EXCHANGE.topPad + EXCHANGE_ROW.height / 2;
  return { height, centers: Array.from({ length: rows }, (_, index) => first + index * (EXCHANGE_ROW.height + EXCHANGE.gap)) };
}
