/**
 * 로비 패스 창의 자리표(창 중심 기준).
 *
 * 위에서부터 **패스 이름(제목표) → 패스 레벨과 레벨 단위로 끊긴 게이지 → 목록(보상 또는 미션) → 미션·보상 탭과
 * 받기 → 패스 탭** 순이다. 목록은 마디 열 줄이 스크롤 없이 한 판에 들도록 줄 높이를 잡는다 — 패스는 길 전체가
 * 한눈에 보여야 지금 어디쯤인지 읽힌다.
 *
 * 보상 줄은 **가운데에 레벨**, 왼쪽에 무료 칸, 오른쪽에 유료(패스) 칸이 선다.
 */
export const PASS_POPUP = {
  width: 1000,
  height: 1600,
  /** 판 안쪽 여백. 줄·게이지·탭이 모두 이 폭 안에 든다. */
  inner: 920,
  header: { levelY: 92, levelSize: 52, progressSize: 26, gaugeY: 160, gaugeHeight: 26 },
  list: {
    top: 214,
    headerHeight: 66,
    rowHeight: 102,
    rowPlate: 90,
    /** 가운데 레벨 칸의 폭. 양옆 칸은 남은 폭을 반씩 나눠 갖는다. */
    levelWidth: 170,
    frame: 78,
    frameGap: 12,
  },
  /** 목록 아래 한 줄 — 왼쪽에 미션·보상 탭, 오른쪽에 받기. */
  modeRow: { fromBottom: 196, tabWidth: 200, tabHeight: 76, tabGap: 8, button: { width: 340, height: 88 } },
  /** 맨 아래 패스 탭 줄. */
  passRow: { fromBottom: 78, tabHeight: 80, tabGap: 8 },
  /** 유료 칸 머리의 열기 버튼. */
  unlock: { width: 300, height: 56 },
} as const;

/** 줄 판의 세 칸 중심 x — 왼쪽 무료, 가운데 레벨, 오른쪽 유료. */
export function passPopupColumns(): { free: number; level: number; paid: number; sideWidth: number } {
  const { inner, list } = PASS_POPUP;
  const sideWidth = (inner - list.levelWidth) / 2;
  return { free: -inner / 2 + sideWidth / 2, level: 0, paid: inner / 2 - sideWidth / 2, sideWidth };
}

/** 목록 머리(열 이름 줄)의 중심 y. */
export function passPopupListHeaderY(): number {
  return -PASS_POPUP.height / 2 + PASS_POPUP.list.top + PASS_POPUP.list.headerHeight / 2;
}

/** i번째 줄의 중심 y. */
export function passPopupRowY(index: number): number {
  const { height, list } = PASS_POPUP;
  return -height / 2 + list.top + list.headerHeight + list.rowHeight * (index + 0.5);
}

/** 목록이 끝나는 y — 그 아래로 탭 줄이 선다. 마디 수가 늘어 이 선을 넘으면 테스트가 잡는다. */
export function passPopupListBottom(): number {
  return PASS_POPUP.height / 2 - PASS_POPUP.modeRow.fromBottom - PASS_POPUP.modeRow.tabHeight / 2 - 24;
}

/** 칸 안 액자 `count`장의 중심 x(칸 중심 기준). */
export function passPopupFrameXs(count: number): number[] {
  const { frame, frameGap } = PASS_POPUP.list;
  const span = count * frame + Math.max(0, count - 1) * frameGap;
  return Array.from({ length: count }, (_, index) => -span / 2 + frame / 2 + index * (frame + frameGap));
}

/** 패스 탭 `count`장의 중심 x와 폭. */
export function passPopupPassTabs(count: number): { width: number; xs: number[] } {
  const { inner, passRow } = PASS_POPUP;
  const width = (inner - passRow.tabGap * (count - 1)) / count;
  return { width, xs: Array.from({ length: count }, (_, index) => -inner / 2 + width / 2 + index * (width + passRow.tabGap)) };
}
