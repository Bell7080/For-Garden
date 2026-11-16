import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 도움말 창의 자리표.
 *
 * 회고 창과 같은 몫(화면에서 좌우·위아래 여백만 남긴다)을 쓰고, 목록은 제목표 아래·탭 줄 위의 창 안에서 흐른다.
 * 용어 줄은 설명 길이가 언어마다 달라 **높이를 글자에서 거꾸로 구한다** — 손으로 적으면 긴 언어에서 다음 줄을 덮는다.
 * 다시 보기 줄은 누르는 줄이라 높이가 하나로 같다.
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
  term: {
    padTop: 30,
    padBottom: 32,
    nameSize: 40,
    /** 이름과 설명 사이. */
    nameGap: 16,
    bodySize: 31,
    lineSpacing: 8,
  },
  tutorial: {
    height: 156,
    icon: 108,
    /** 액자 오른쪽에서 글이 시작하는 거리. */
    textGap: 30,
    nameSize: 40,
    subSize: 27,
    nameY: -24,
    subY: 30,
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

/** 줄 높이들을 차례로 쌓아 각 줄의 윗변 y(흐르는 목록 좌표, 창 윗변이 0)와 전체 높이를 낸다. */
export function stackHelpRows(heights: readonly number[]): { tops: number[]; total: number } {
  const { listPad, row } = HELP_LAYOUT;
  const tops: number[] = [];
  let y = listPad;
  heights.forEach((height, index) => {
    tops.push(y);
    y += height + (index < heights.length - 1 ? row.gap : 0);
  });
  return { tops, total: heights.length === 0 ? 0 : y + listPad * 2 };
}

/** 흐르는 목록 좌표의 y가 어느 줄 위인지. 줄 사이 틈이면 `undefined`. */
export function helpRowAt(localY: number, tops: readonly number[], heights: readonly number[]): number | undefined {
  for (let index = 0; index < tops.length; index += 1) {
    if (localY >= tops[index] && localY <= tops[index] + heights[index]) return index;
  }
  return undefined;
}
