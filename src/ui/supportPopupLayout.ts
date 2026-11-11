/**
 * 문의 창의 자리. 모든 y는 판 윗변에서 아래로 잰 값이고 창 높이는 쌓인 내용에서 거꾸로 구한다.
 * Phaser를 읽지 않아 테스트가 같은 표로 줄이 판 안에 드는지, 서로 겹치지 않는지 지킨다.
 *
 * 위는 내용, 아래는 **두 줄의 밑동**이다 — 작성/내 문의 라벨이 왼쪽 아래에(우편함·임무와 같은 자리),
 * 그 아래 조작 줄이 선다. 조작 줄은 화면마다 칸을 같은 표로 나눠 쓴다: 하나면 가운데, 둘이면
 * 확인 창과 같이 왼쪽 되돌리기 · 오른쪽 진행이다. 오른쪽 아래 구석 밖은 뒤로가기 자리라 비워 둔다.
 */
export const SUPPORT_POPUP = {
  width: 940,
  margin: 40,
  /** 작성 화면의 안쪽 유리 판 — 종류 칩부터 내용 칸까지 한 덩어리로 품는다. */
  form: { top: 96, bottom: 960, pad: 22 },
  chips: { y: 150, width: 156, height: 70, gap: 10 },
  /** 이름표 줄 — 왼쪽에 빗금과 이름, 오른쪽 끝에 글자 수. `fieldY`는 입력 칸의 **가운데**다(TextInputField가 가운데 기준). */
  subject: { labelY: 228, fieldY: 306, height: 88 },
  body: { labelY: 388, fieldY: 676, height: 496 },
  list: { top: 96, rowHeight: 112, rowGap: 12, rows: 7 },
  detail: { headY: 148, headHeight: 104, textTop: 216, textHeight: 556, replyLabelY: 800, replyFieldY: 896, replyHeight: 144 },
  /** 밑동 — 구분선, 라벨 탭 줄(왼쪽 정렬), 조작 줄. */
  footer: {
    lineY: 1000,
    tabY: 1050,
    tab: { width: 240, height: 76, gap: 12 },
    actionY: 1162,
    action: { width: 360, height: 96, gap: 40 },
  },
  foot: 60,
} as const;

export function supportContentWidth(): number { return SUPPORT_POPUP.width - SUPPORT_POPUP.margin * 2; }

/** 라벨 탭 `index`의 가운데 x — 내용 폭 왼쪽 끝부터 붙는다. */
export function supportTabX(index: number): number {
  const { width, gap } = SUPPORT_POPUP.footer.tab;
  return -supportContentWidth() / 2 + width / 2 + index * (width + gap);
}

/** 조작 줄 칸의 가운데 x — 하나면 가운데, 둘이면 좌우로 나눈다(확인 창과 같은 나눔). */
export function supportActionXs(count: 1 | 2): number[] {
  if (count === 1) return [0];
  const { width, gap } = SUPPORT_POPUP.footer.action;
  const offset = (width + gap) / 2;
  return [-offset, offset];
}

export function contentBottoms(): { compose: number; list: number; detail: number } {
  const { form, list, detail } = SUPPORT_POPUP;
  return {
    compose: form.bottom,
    list: list.top + list.rows * list.rowHeight + (list.rows - 1) * list.rowGap,
    detail: detail.replyFieldY + detail.replyHeight / 2,
  };
}

export function supportPopupHeight(): number {
  const { footer, foot } = SUPPORT_POPUP;
  return footer.actionY + footer.action.height / 2 + foot;
}

export function chipX(index: number, count: number): number { const { width, gap } = SUPPORT_POPUP.chips; return (index - (count - 1) / 2) * (width + gap); }
