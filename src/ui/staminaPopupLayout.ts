/**
 * 스테미나 창의 자리 계산.
 *
 * Phaser 없이 읽히는 순수 규칙만 둔다 — 창 안의 판·액자·칸이 팝업 밖으로 삐져나가지 않는지,
 * 세 칸이 정말 균등한지를 화면을 띄우지 않고 테스트로 고정하기 위해서다.
 */

/** 팝업 몸판과 같은 비율 규칙으로 깎는다. 이 값은 `PopupLayer`가 쓰는 것과 반드시 같아야 한다. */
export const POPUP_BEVEL_RATIO = 0.14;

export interface StaminaPopupLayout {
  width: number;
  height: number;
  /** 위쪽 전용 판. 팝업 안쪽 좌표(가운데가 0)의 사각형이다. */
  hero: { y: number; width: number; height: number };
  /** 판 안에서 세로로 가운데 정렬한 액자·수치·시간의 중심 y다. */
  heroStack: { frameY: number; valueY: number; timerY?: number };
  frameSize: number;
  /** 충전 제목과 세 칸. */
  rechargeTitleY: number;
  cell: { y: number; width: number; height: number; centers: readonly [number, number, number] };
  /** 사용처 구분선과 제목. */
  hairlineY: number;
  usesTitleY: number;
  usesFirstRowY: number;
  usesRowHeight: number;
}

const BASE = {
  width: 760,
  /**
   * 창 좌우 안쪽 여백. 판·칸·구분선이 모두 이 폭 안에 선다.
   *
   * 위쪽 여백과 **합쳐서** 몸판의 깎인 왼쪽 위 모서리(폭의 14%)를 넘어야 판이 그 빗변 안에
   * 든다. 둘 중 하나만 줄여도 판의 왼쪽 위 귀퉁이가 창 밖으로 나가므로 함께 본다.
   */
  padX: 56,
  /** 제목표가 윗변에 걸터앉으므로 판은 그보다 아래에서 시작한다. */
  heroTop: 58,
  heroHeight: 268,
  heroPadY: 20,
  frameSize: 132,
  /** 수치(52px)와 시간(22px) 줄이 실제로 차지하는 높이다. */
  valueHeight: 58,
  timerHeight: 30,
  gapFrameValue: 10,
  gapValueTimer: 4,
  heroToTitle: 46,
  titleToCells: 40,
  cellHeight: 236,
  cellGap: 18,
  cellsToHairline: 40,
  hairlineToTitle: 34,
  titleToRow: 52,
  usesRowHeight: 44,
  bottomPad: 44,
} as const;

/**
 * 창 하나의 모든 자리를 한 번에 만든다.
 *
 * 높이를 손으로 적지 않고 **쌓인 내용에서 거꾸로 구한다** — 사용처 줄이 늘거나 칸 높이를 고치면
 * 창이 저절로 그만큼 자라, 마지막 줄이 판 밖으로 밀려나는 일이 생기지 않는다.
 */
export function staminaPopupLayout(useRows: number, cells = 3): StaminaPopupLayout {
  const inner = BASE.width - BASE.padX * 2;
  const cellWidth = (inner - BASE.cellGap * (cells - 1)) / cells;

  // 위에서부터 쌓아 전체 높이를 먼저 구한 뒤, 가운데가 0인 좌표로 옮긴다.
  const heroTop = BASE.heroTop;
  const heroBottom = heroTop + BASE.heroHeight;
  const rechargeTitleTop = heroBottom + BASE.heroToTitle;
  const cellTop = rechargeTitleTop + BASE.titleToCells;
  const cellBottom = cellTop + BASE.cellHeight;
  const hairlineTop = cellBottom + BASE.cellsToHairline;
  const usesTitleTop = hairlineTop + BASE.hairlineToTitle;
  const firstRowTop = usesTitleTop + BASE.titleToRow;
  const height = firstRowTop + Math.max(0, useRows - 1) * BASE.usesRowHeight + BASE.bottomPad;
  const top = -height / 2;

  const heroY = top + heroTop + BASE.heroHeight / 2;
  const centers: number[] = [];
  for (let index = 0; index < cells; index += 1) {
    centers.push(-inner / 2 + cellWidth / 2 + index * (cellWidth + BASE.cellGap));
  }

  return {
    width: BASE.width,
    height,
    hero: { y: heroY, width: inner, height: BASE.heroHeight },
    heroStack: heroStack(heroY, useRows >= 0),
    frameSize: BASE.frameSize,
    rechargeTitleY: top + rechargeTitleTop,
    cell: { y: top + cellTop + BASE.cellHeight / 2, width: cellWidth, height: BASE.cellHeight, centers: centers as unknown as readonly [number, number, number] },
    hairlineY: top + hairlineTop,
    usesTitleY: top + usesTitleTop,
    usesFirstRowY: top + firstRowTop,
    usesRowHeight: BASE.usesRowHeight,
  };
}

/**
 * 액자·수치·시간을 판 안에서 **한 덩어리로 세로 가운데** 세운다.
 *
 * 각 줄의 y를 판 위쪽부터 고정값으로 적으면 시간 줄이 사라지는 순간(가득 찼을 때) 남은 둘이
 * 위로 쏠려 보인다. 실제로 쌓인 높이를 먼저 재고 그 덩어리를 가운데에 놓는다.
 */
export function heroStack(centerY: number, withTimer: boolean): { frameY: number; valueY: number; timerY?: number } {
  const total = BASE.frameSize + BASE.gapFrameValue + BASE.valueHeight
    + (withTimer ? BASE.gapValueTimer + BASE.timerHeight : 0);
  let cursor = centerY - total / 2;
  const frameY = cursor + BASE.frameSize / 2;
  cursor += BASE.frameSize + BASE.gapFrameValue;
  const valueY = cursor + BASE.valueHeight / 2;
  if (!withTimer) return { frameY, valueY };
  cursor += BASE.valueHeight + BASE.gapValueTimer;
  return { frameY, valueY, timerY: cursor + BASE.timerHeight / 2 };
}

/**
 * 팝업 몸판의 깎인 모서리를 피해 안쪽에 서는지 검사한다.
 *
 * 몸판은 왼쪽 위와 오른쪽 아래만 크게 깎여 있어, 안쪽 판을 네모로 두면 그 대각선을 넘어 밖으로
 * 삐져나온다. 판이 실제로 몸판 안에 있는지 확인하는 순수 규칙이다.
 */
export function insidePopupBody(
  popup: { width: number; height: number },
  rect: { y: number; width: number; height: number },
): boolean {
  const bevel = Math.min(popup.width, popup.height) * POPUP_BEVEL_RATIO;
  const corners = [
    { x: -rect.width / 2, y: rect.y - rect.height / 2 },
    { x: rect.width / 2, y: rect.y - rect.height / 2 },
    { x: rect.width / 2, y: rect.y + rect.height / 2 },
    { x: -rect.width / 2, y: rect.y + rect.height / 2 },
  ];
  return corners.every(({ x, y }) => {
    if (Math.abs(x) > popup.width / 2 || Math.abs(y) > popup.height / 2) return false;
    // 왼쪽 위 빗변: x + y가 그 모서리 안쪽에 있어야 한다.
    const fromLeftTop = (x + popup.width / 2) + (y + popup.height / 2);
    if (fromLeftTop < bevel) return false;
    // 오른쪽 아래 빗변도 같은 방식으로 잰다.
    const fromRightBottom = (popup.width / 2 - x) + (popup.height / 2 - y);
    return fromRightBottom >= bevel;
  });
}
