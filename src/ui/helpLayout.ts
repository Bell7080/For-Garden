import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 도움말 창의 자리표.
 *
 * 회고 창과 같은 몫(화면에서 좌우·위아래 여백만 남긴다)을 쓰고, 목록은 제목표 아래·탭 줄 위의 창 안에서 흐른다.
 * 용어는 갈래 머리줄 아래 이름만 선 접힌 줄로 서고, 누른 줄 하나만 펼쳐진다. 펼친 줄은 설명 길이가 언어마다 달라
 * **높이를 글자에서 거꾸로 구한다** — 손으로 적으면 긴 언어에서 다음 줄을 덮는다. 접힌 줄의 이름은 펼쳐도 같은 높이에
 * 서도록 위 여백을 맞춘다(펼치는 순간 이름이 튀지 않게).
 * 다시 보기 줄은 그 콘텐츠의 원화를 깐 층이라 높이가 하나로 같다.
 */
const POPUP_HEIGHT = BASE_HEIGHT - 210;

export const HELP_LAYOUT = {
  popup: { width: BASE_WIDTH - 70, height: POPUP_HEIGHT },
  /** 목록이 흐르는 창(팝업 몸판 좌표). 위는 제목표 아래, 아래는 탭 줄 위에서 끊는다. */
  viewport: { top: -POPUP_HEIGHT / 2 + 128, bottom: POPUP_HEIGHT / 2 - 196 },
  row: {
    width: BASE_WIDTH - 70 - 80,
    bevel: 24,
    /** 줄 사이 틈. */
    gap: 18,
    /** 글이 판 왼쪽 변에서 들어오는 거리. */
    inset: 40,
  },
  /** 갈래 머리줄 — 공용 제목표가 선다. 앞 갈래와는 넓게, 제 용어와는 좁게 띄운다. */
  group: { height: 74, titleSize: 34, gapBefore: 40, gapAfter: 8 },
  term: {
    /** 접힌 줄의 높이. 이름 한 줄과 펼침 표식만 선다. */
    collapsed: 96,
    /** 같은 갈래 안의 줄 사이. */
    gap: 12,
    /** 접힌 줄과 같은 높이에 이름이 서는 위 여백 — (collapsed − nameSize) / 2. */
    padTop: 29,
    padBottom: 32,
    nameSize: 38,
    /** 이름과 설명 사이. */
    nameGap: 16,
    bodySize: 31,
    lineSpacing: 8,
    /** 오른쪽 끝 펼침 표식(판 오른쪽 변에서)과 크기. */
    caretRight: 56,
    caretSize: 30,
  },
  tutorial: {
    height: 176,
    nameSize: 42,
    subSize: 27,
    nameY: -26,
    subY: 32,
    /** 원화 위 어둠 — 글이 서는 왼쪽은 짙게, 오른쪽은 원화가 비치게. */
    fadeLeft: 0.92,
    fadeMid: 0.62,
    fadeRight: 0.14,
    /** 짙은 구간이 끝나는 자리(줄 폭 비율). */
    fadeSplit: 0.55,
    /** 아직 지나오지 않은 안내의 원화 진하기. */
    lockedArtAlpha: 0.32,
    /** 오른쪽 끝의 「다시 보기」 화살표·자물쇠 자리(판 오른쪽 변에서). */
    markRight: 64,
  },
  tab: { width: 240, height: 70, gap: 8, y: POPUP_HEIGHT / 2 - 110 },
  /** 목록 위·아래 여백. */
  listPad: 12,
} as const;

export type HelpTab = "terms" | "tutorials";

export const HELP_TABS: readonly HelpTab[] = ["terms", "tutorials"];

/** 창의 높이. */
export function helpViewportHeight(): number {
  return HELP_LAYOUT.viewport.bottom - HELP_LAYOUT.viewport.top;
}

/** 용어 줄 하나의 높이 — 실제로 그린 설명 글의 높이에서 구한다. */
export function helpTermRowHeight(bodyHeight: number): number {
  const { term } = HELP_LAYOUT;
  return term.padTop + term.nameSize + term.nameGap + bodyHeight + term.padBottom;
}

/**
 * 줄 높이들을 차례로 쌓아 각 줄의 윗변 y(흐르는 목록 좌표, 창 윗변이 0)와 전체 높이를 낸다.
 * `gaps[i]`는 i번째 줄 **앞**의 틈이다(첫 줄은 무시). 없으면 기본 줄 틈을 쓴다.
 */
export function stackHelpRows(heights: readonly number[], gaps: readonly number[] = []): { tops: number[]; total: number } {
  const { listPad, row } = HELP_LAYOUT;
  const tops: number[] = [];
  let y = listPad;
  heights.forEach((height, index) => {
    if (index > 0) y += gaps[index] ?? row.gap;
    tops.push(y);
    y += height;
  });
  return { tops, total: heights.length === 0 ? 0 : y + listPad * 2 };
}

/** 펼친 줄이 창 안에 다 보이도록 고친 스크롤 값(0 이하). 이미 보이면 그대로 둔다. */
export function helpRevealScroll(scroll: number, top: number, height: number, viewHeight: number, minScroll: number): number {
  const pad = HELP_LAYOUT.listPad;
  let next = scroll;
  if (top + height + next > viewHeight - pad) next = viewHeight - pad - (top + height);
  if (top + next < pad) next = pad - top;
  return Math.min(0, Math.max(minScroll, next));
}

/** 흐르는 목록 좌표의 y가 어느 줄 위인지. 줄 사이 틈이면 `undefined`. */
export function helpRowAt(localY: number, tops: readonly number[], heights: readonly number[]): number | undefined {
  for (let index = 0; index < tops.length; index += 1) {
    if (localY >= tops[index] && localY <= tops[index] + heights[index]) return index;
  }
  return undefined;
}
