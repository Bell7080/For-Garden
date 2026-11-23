import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";

/**
 * 룬 정비 창의 자리 — 위에서부터 **하트 세 칸 → 비교 판 → 칸 조작 → 목록 조작 두 줄 → 룬 목록 → 아래 조작**이다.
 *
 * 세 칸은 카드 셋이 아니라 **정보창과 같은 하트 한 장**이다 — 1번(위 왼쪽)·2번(위 오른쪽)·3번(아래) 조각이 제 자리에
 * 서고, 그 칸의 이름·주 옵션이 하트의 왼쪽·오른쪽·아래에 선다. 같은 크기의 카드 셋으로 나란히 세우던 때는 어느 카드가
 * 어느 조각인지 읽히지 않았다(응태 2026-11-17). 비교 판은 제목표(`/교체 비교`)를 달고 하트 판과 떨어져 선다.
 *
 * Phaser 없는 모듈이라 배치표와 테스트가 같은 값을 읽는다. 세로 자리는 판 윗변에서 잰 값이고, 창 높이는
 * 마지막 줄 아래 여백에서 거꾸로 구한다(`runeWorkbenchHeight`) — 손으로 적으면 줄을 옮길 때마다 어긋난다.
 */
export const RUNE_WORKBENCH = {
  width: 960,
  padX: 40,
  /**
   * 제목표 오른쪽 띠의 전투력 줄(오른쪽 정렬). 이 창에서 가장 먼저 읽는 수라 크게 세우고(응태 2026-11-23),
   * 하트 판 윗변(`heart.top`)과 한 뼘 띄운다. `room`은 제목표를 비켜 수가 쓸 수 있는 폭이다.
   */
  power: { y: 60, label: 24, value: 50, gap: 6, room: 560 },
  /** 버튼 셋이 판 안쪽 폭을 나눠 갖는 사이. */
  slots: { gap: 14 },
  /**
   * 하트 판. 조각 원화는 캔버스의 가로 0.66·세로 0.63만 채운다(`RUNE_HEART_REACH`). `centerY`는 판 윗변에서 하트 기준점(`RUNE_CENTER_Y`)까지, `pop`은 고른 조각이 바깥으로 튀어나오는 거리다.
   * 옆 글 판(`side`)은 하트 기준점에서 `y`만큼 위에, 아래 글 판(`bottom`)은 `y`만큼 아래에 선다.
   */
  heart: {
    top: 112, height: 355, size: 340, centerY: 122, pop: 16, number: 40, tag: 18,
    side: { gap: 14, y: -14, height: 132, name: 26, stat: 20, line: 30 },
    bottom: { y: 180, width: 500, height: 74, name: 26, stat: 20 },
  },
  /** 비교 판. `gap`은 제목표가 걸터앉을 자리까지 품는다. */
  compare: { gap: 44, height: 262, pad: 22, label: 19, title: 26, icon: 64, name: 28, line: 21, lineHeight: 27, arrow: 26, moved: 20 },
  actions: { gap: 14, height: 64, fontSize: 24 },
  controls: { gap: 14 },
  grid: { columns: 5, card: 152, cell: 172, rows: 3, listGap: 18, delta: 22, tag: 23 },
  footer: { gap: 22, height: 84, fontSize: 26, bottom: 24 },
} as const;

const W = RUNE_WORKBENCH;

/** 하트 원화가 기준점에서 옆으로 뻗는 몫(캔버스 한 변에 대한 비율 — 알파 경계 실측 46~214 / 256). */
export const RUNE_HEART_REACH = 0.33;

/** 둘씩 서는 조작 줄(해제 · 모두 해제)이 판 안쪽 폭을 반씩 나눠 갖는 폭. */
export function runeWorkbenchFooterWidth(): number {
  return (W.width - W.padX * 2 - W.slots.gap) / 2;
}

/** 아래 조작 둘의 가로 중심(0 왼쪽 · 1 오른쪽). */
export function runeWorkbenchFooterX(index: 0 | 1): number {
  const half = (runeWorkbenchFooterWidth() + W.slots.gap) / 2;
  return index === 0 ? -half : half;
}

/**
 * 맨 아래 조작 셋(남은 룬 끼기 · 옮겨 끼기 · 적용)이 판 안쪽 폭을 셋으로 나눠 갖는 폭. 추천 둘을 한 버튼에 묶어 두던
 * 때는 늘 옮겨 끼기 쪽만 물었다(응태 2026-11-23) — 어느 룬으로 채울지를 버튼이 먼저 가른다.
 */
export function runeWorkbenchFooter3Width(): number {
  return (W.width - W.padX * 2 - W.slots.gap * 2) / 3;
}

/** 아래 조작 셋의 가로 중심(0 왼쪽 · 1 가운데 · 2 오른쪽). */
export function runeWorkbenchFooter3X(index: 0 | 1 | 2): number {
  return (index - 1) * (runeWorkbenchFooter3Width() + W.slots.gap);
}

export interface RuneWorkbenchRows {
  /** 하트 기준점(조각 셋이 함께 서는 점)의 세로 자리. */
  heartY: number;
  compareTop: number;
  actionsY: number;
  /** 목록 조작 첫 줄의 세로 중심. */
  controlsY: number;
  listTop: number;
  viewHeight: number;
  footerY: number;
  height: number;
}

/** 판 윗변에서 잰 세로 자리와 창 높이. */
export function runeWorkbenchRows(): RuneWorkbenchRows {
  const heartY = W.heart.top + W.heart.centerY;
  const compareTop = W.heart.top + W.heart.height + W.compare.gap;
  const actionsY = compareTop + W.compare.height + W.actions.gap + W.actions.height / 2;
  const controlsTop = actionsY + W.actions.height / 2 + W.controls.gap;
  const controlsY = controlsTop + RUNE_LIST_CONTROLS.rowHeight / 2;
  const listTop = controlsTop + RUNE_LIST_CONTROLS.height + W.grid.listGap;
  const viewHeight = W.grid.rows * W.grid.cell;
  const footerY = listTop + viewHeight + W.footer.gap + W.footer.height / 2;
  const height = footerY + W.footer.height / 2 + W.footer.bottom;
  return { heartY, compareTop, actionsY, controlsY, listTop, viewHeight, footerY, height };
}

/** 목록 칸 하나의 자리(목록 윗변 기준). */
export function runeWorkbenchCell(order: number): { x: number; y: number } {
  const g = W.grid;
  const firstX = -((g.columns - 1) * g.cell) / 2;
  return { x: firstX + (order % g.columns) * g.cell, y: g.cell / 2 + Math.floor(order / g.columns) * g.cell };
}

/** 목록이 이만큼 길 때 위로 끌 수 있는 한도(0 이하). */
export function runeWorkbenchMinScroll(shown: number, viewHeight: number): number {
  return Math.min(0, viewHeight - Math.ceil(shown / W.grid.columns) * W.grid.cell);
}

/** 하트 옆 글 판(1번 왼쪽 · 2번 오른쪽)의 가로 범위 — 판 안쪽 끝에서 하트 가장자리 앞까지. */
export function runeWorkbenchSideSpan(side: "left" | "right"): { left: number; right: number } {
  const outer = W.width / 2 - W.padX;
  const inner = W.heart.size * RUNE_HEART_REACH + W.heart.pop + W.heart.side.gap;
  return side === "left" ? { left: -outer, right: -inner } : { left: inner, right: outer };
}

/** 판 밑변이 판 밖 우하단 뒤로가기 위에서 멈추는 여백 — 창을 위아래로 길게 쓰되 그 버튼을 덮지 않는다. */
export const RUNE_WORKBENCH_BACK_CLEARANCE = 22;
