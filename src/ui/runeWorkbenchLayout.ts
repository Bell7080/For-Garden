import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";

/**
 * 룬 정비 창의 자리 — 위에서부터 **세 칸 → 비교 판 → 칸 조작 → 목록 조작 두 줄 → 룬 목록 → 아래 조작**이다.
 *
 * Phaser 없는 모듈이라 배치표와 테스트가 같은 값을 읽는다. 세로 자리는 판 윗변에서 잰 값이고, 창 높이는
 * 마지막 줄 아래 여백에서 거꾸로 구한다(`runeWorkbenchHeight`) — 손으로 적으면 줄을 옮길 때마다 어긋난다.
 */
export const RUNE_WORKBENCH = {
  width: 960,
  padX: 40,
  /** 제목표 오른쪽 띠의 전투력 줄(오른쪽 정렬). */
  power: { y: 44, label: 20, value: 34, gap: 6 },
  slots: { top: 84, height: 140, gap: 14, frame: 84, raise: 8, name: 26, stat: 19, part: 18, tag: 18 },
  compare: { gap: 16, height: 232, pad: 22, label: 19, name: 28, line: 21, lineHeight: 27, arrow: 26, moved: 20 },
  actions: { gap: 14, height: 64, fontSize: 24 },
  controls: { gap: 18 },
  grid: { columns: 5, card: 152, cell: 172, rows: 3, listGap: 18, delta: 22, tag: 17 },
  footer: { gap: 22, height: 84, fontSize: 26, bottom: 32 },
} as const;

const W = RUNE_WORKBENCH;

/** 칸 카드 하나의 폭 — 세 칸이 판 안쪽 폭을 나눠 갖는다. 칸 조작·아래 조작 버튼도 같은 폭이다. */
export function runeWorkbenchColumnWidth(): number {
  return (W.width - W.padX * 2 - W.slots.gap * 2) / 3;
}

/** 세 칸(과 버튼 셋)의 가로 중심. */
export function runeWorkbenchColumnX(index: number): number {
  const width = runeWorkbenchColumnWidth();
  return -W.width / 2 + W.padX + width / 2 + index * (width + W.slots.gap);
}

export interface RuneWorkbenchRows {
  slotsY: number;
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
  const slotsY = W.slots.top + W.slots.height / 2;
  const compareTop = W.slots.top + W.slots.height + W.compare.gap;
  const actionsY = compareTop + W.compare.height + W.actions.gap + W.actions.height / 2;
  const controlsTop = actionsY + W.actions.height / 2 + W.controls.gap;
  const controlsY = controlsTop + RUNE_LIST_CONTROLS.rowHeight / 2;
  const listTop = controlsTop + RUNE_LIST_CONTROLS.height + W.grid.listGap;
  const viewHeight = W.grid.rows * W.grid.cell;
  const footerY = listTop + viewHeight + W.footer.gap + W.footer.height / 2;
  const height = footerY + W.footer.height / 2 + W.footer.bottom;
  return { slotsY, compareTop, actionsY, controlsY, listTop, viewHeight, footerY, height };
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
