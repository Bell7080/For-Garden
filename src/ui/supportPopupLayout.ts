/**
 * 문의 창의 자리. 모든 y는 판 윗변에서 아래로 잰 값이고 창 높이는 쌓인 내용에서 거꾸로 구한다.
 * Phaser를 읽지 않아 테스트가 같은 표로 줄이 판 안에 드는지, 서로 겹치지 않는지 지킨다.
 */
export const SUPPORT_POPUP = {
  width: 940,
  /** 판 안쪽 좌우 여백. */
  margin: 40,
  tabs: { y: 150, width: 300, height: 76, gap: 18 },
  /** 종류 칩 한 줄. */
  chips: { y: 262, width: 196, height: 70, gap: 14 },
  subject: { labelY: 340, fieldY: 420, height: 92 },
  body: { labelY: 500, fieldY: 560, height: 520 },
  counterY: 842,
  submit: { y: 920, width: 360, height: 96 },
  /** 목록 줄. */
  list: { top: 230, rowHeight: 118, rowGap: 12, rows: 7 },
  pager: { gapBelow: 40, height: 72 },
  detail: { headY: 230, textTop: 330, textHeight: 560, replyLabelY: 930, replyFieldY: 1020, replyHeight: 180, sendY: 1170, backY: 1170 },
  /** 마지막 줄 아래에 남기는 여백. */
  foot: 90,
} as const;

/** 내용 영역의 폭(좌우 여백을 뺀 값). */
export function supportContentWidth(): number { return SUPPORT_POPUP.width - SUPPORT_POPUP.margin * 2; }

/** 작성 화면이 가장 아래에서 닿는 y. */
export function composeBottom(): number { return SUPPORT_POPUP.submit.y + SUPPORT_POPUP.submit.height / 2; }

/** 목록 화면이 가장 아래에서 닿는 y(쪽 넘김 줄 포함). */
export function listBottom(): number {
  const { top, rowHeight, rowGap, rows } = SUPPORT_POPUP.list;
  return top + rows * (rowHeight + rowGap) + SUPPORT_POPUP.pager.gapBelow + SUPPORT_POPUP.pager.height;
}

/** 상세 화면이 가장 아래에서 닿는 y. */
export function detailBottom(): number { return SUPPORT_POPUP.detail.sendY + SUPPORT_POPUP.submit.height / 2; }

/** 창 높이: 세 화면 중 가장 깊은 곳 아래에 여백을 더한다. */
export function supportPopupHeight(): number { return Math.max(composeBottom(), listBottom(), detailBottom()) + SUPPORT_POPUP.foot; }

/** 종류 칩 `index`번째(0부터)의 가운데 x. 몸 가운데가 0이다. */
export function chipX(index: number, count: number): number {
  const { width, gap } = SUPPORT_POPUP.chips;
  return (index - (count - 1) / 2) * (width + gap);
}
