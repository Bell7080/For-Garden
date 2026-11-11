/**
 * 문의 창의 자리. 모든 y는 판 윗변에서 아래로 잰 값이고 창 높이는 쌓인 내용에서 거꾸로 구한다.
 * Phaser를 읽지 않아 테스트가 같은 표로 줄이 판 안에 드는지, 서로 겹치지 않는지 지킨다.
 */
export const SUPPORT_POPUP = {
  width: 940,
  margin: 40,
  tabs: { y: 150, width: 300, height: 76, gap: 18 },
  /** 작성 화면의 안쪽 유리 판 — 종류 칩부터 내용 칸까지 한 덩어리로 품는다. 보내기는 판 밖 아래에 선다. */
  form: { top: 214, bottom: 1000, pad: 22 },
  chips: { y: 268, width: 156, height: 70, gap: 10 },
  /** 이름표 줄 — 왼쪽에 빗금과 이름, 오른쪽 끝에 글자 수. `fieldY`는 입력 칸의 **가운데**다(TextInputField가 가운데 기준). */
  subject: { labelY: 346, fieldY: 424, height: 88 },
  body: { labelY: 506, fieldY: 748, height: 400 },
  submit: { y: 1084, width: 420, height: 96 },
  list: { top: 230, rowHeight: 118, rowGap: 12, rows: 7 },
  pager: { gapBelow: 40, height: 72 },
  detail: { headY: 262, headHeight: 104, textTop: 330, textHeight: 562, replyLabelY: 920, replyFieldY: 1030, replyHeight: 160, sendY: 1170, backY: 1170 },
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
