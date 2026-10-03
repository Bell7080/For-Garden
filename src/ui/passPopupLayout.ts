/**
 * 로비 패스 창의 자리표(창 중심 기준).
 *
 * 위에서부터 **패스 이름(제목표) → 패스 레벨과 레벨 단위로 끊긴 게이지 → 목록(보상 또는 미션) → 미션·보상 탭과
 * 받기 → 패스 탭** 순이다. 목록은 마디 열다섯 줄이 **창 안에서 아래로 흐른다** — 한 판에 다 넣으려고 줄을 줄이면
 * 액자가 작아져 무엇을 받는지보다 줄 수가 먼저 읽힌다.
 *
 * 보상 줄은 **가운데에 레벨**, 왼쪽에 무료 칸, 오른쪽에 유료(패스) 칸이 선다. 가운데 레벨 열에는 세로 게이지가 줄을
 * 꿰뚫고 내려가, 닿은 레벨까지 한 칸씩 차오른다.
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
    rowHeight: 150,
    rowPlate: 134,
    /** 가운데 레벨 칸의 폭. 양옆 칸은 남은 폭을 반씩 나눠 갖는다. */
    levelWidth: 190,
    frame: 108,
    frameGap: 14,
    /** 가운데 레벨 마름모와 그 아래 문턱 글자. */
    badge: { width: 96, height: 64, size: 38, stepY: 52, stepSize: 22 },
    /** 세로 게이지의 굵기. */
    rail: 14,
    /** 목록 맨 위·아래 여백. 첫 줄의 판이 창 윗변에 붙지 않게 한다. */
    pad: 10,
  },
  /** 받을 수 있는 칸의 노란 맥동 — 임무의 받을 수 있는 액자와 같은 결이다. */
  pulse: { halo: 24, haloAlpha: 0.42, scale: 1.08, ms: 620 },
  /** 손가락이 이만큼 움직이면 누름이 아니라 끌기다. */
  dragSlop: 14,
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

/** 목록이 흐르는 창(창 중심 기준 y). 머리 줄 아래에서 탭 줄 한 뼘 위까지다. */
export function passPopupViewport(): { top: number; bottom: number; height: number } {
  const top = -PASS_POPUP.height / 2 + PASS_POPUP.list.top + PASS_POPUP.list.headerHeight;
  const bottom = PASS_POPUP.height / 2 - PASS_POPUP.modeRow.fromBottom - PASS_POPUP.modeRow.tabHeight / 2 - 24;
  return { top, bottom, height: bottom - top };
}

/** i번째 줄의 중심 y — 흐르는 목록 안(창 윗변이 0)의 좌표다. */
export function passPopupRowY(index: number): number {
  return PASS_POPUP.list.pad + PASS_POPUP.list.rowHeight * (index + 0.5);
}

/** 줄 `count`개가 쌓인 목록 높이. */
export function passPopupContentHeight(count: number): number {
  return PASS_POPUP.list.pad * 2 + PASS_POPUP.list.rowHeight * count;
}

/** 목록이 올라갈 수 있는 끝(음수). 창보다 짧으면 0이라 흐르지 않는다. */
export function passPopupMinScroll(count: number): number {
  return Math.min(0, passPopupViewport().height - passPopupContentHeight(count));
}

/** 처음 열 때 그 줄이 창 가운데쯤 오도록 하는 스크롤 값. */
export function passPopupScrollFor(index: number, count: number): number {
  const target = passPopupViewport().height / 2 - passPopupRowY(index);
  return Math.max(passPopupMinScroll(count), Math.min(0, target));
}

/**
 * 가운데 세로 게이지가 차오른 끝(목록 안 y). 마디 하나가 한 줄이고, 닿은 레벨의 줄 가운데까지 찬 뒤 다음 줄을
 * 향해 그 사이를 온 만큼 더 내려간다 — 위에서 한 칸씩 아래로 내려가는 느낌이 그대로 길이로 읽힌다.
 */
export function passPopupRailFill(level: number, max: number, partial: number): number {
  if (max <= 0) return 0;
  if (level >= max) return passPopupContentHeight(max);
  const p = Math.max(0, Math.min(1, partial));
  if (level <= 0) return passPopupRowY(0) * p;
  return passPopupRowY(level - 1) + PASS_POPUP.list.rowHeight * p;
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

/**
 * 로비의 패스 카드 — 홍보 칸 자리(프로필 줄 아래)에 한 장씩 서고, 아래 점 줄이 몇 번째 패스인지 말한다.
 * 일정 간격으로 다음 패스가 오른쪽에서 밀려 들어온다. 모서리는 덜 깎아 가로로 긴 이름표로 읽히게 한다.
 */
export const LOBBY_PASS_CARD = {
  left: 30,
  y: 250,
  width: 380,
  height: 132,
  /** 깎임은 높이의 이 비율 — 예전 0.42는 끝이 뭉툭하게 잘려 짧은 쪽지처럼 보였다. */
  bevel: 0.2,
  stripe: 10,
  pad: 34,
  nameSize: 30,
  levelSize: 26,
  nameY: -30,
  gauge: { y: 10, height: 12 },
  noteY: 40,
  noteSize: 20,
  dots: { gap: 28, size: 11, y: 94 },
  /** 다음 패스로 넘어가는 간격과 미끄러지는 시간. */
  cycleMs: 4200,
  slideMs: 460,
  /** 넘길 때 글이 미끄러지는 거리. 판 안쪽 여백(`pad`)보다 작아야 판 밖으로 나가지 않는다 — 자르는 마스크가 없다. */
  slideDistance: 22,
} as const;
