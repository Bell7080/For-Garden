import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";

/**
 * 합성·특성 연구·장착이 룬을 고르는 가방의 격자.
 *
 * 가방(`InventoryPopup`)과 같은 규격의 카드를 **세로로 흐르는 목록**에 세운다 — 쪽을 넘기던 때는 원하는 룬이
 * 몇 쪽에 있는지 몰라 넘겨 보며 찾아야 했다. 위에는 공용 조작 두 줄(필터·검색·정렬 / 토글)이 서고,
 * 목록은 그 아래 `maxRows` 줄까지만 보이고 나머지는 끌어서 내린다. 판 높이는 거르기 전의 수로 정해
 * 조건을 바꿔도 판이 줄었다 늘지 않는다.
 */
export const RUNE_PICK_GRID = {
  columns: 4, cardWidth: 180, cardHeight: 180, cellWidth: 208, cellHeight: 208,
  padX: 48,
  /** 조작 첫 줄(필터·검색·정렬)의 세로 중심 — 판 윗변에서. 제목표 띠 아래다. */
  controlsY: 92,
  /** 토글 줄 아래에서 목록 윗변까지. */
  listGap: 22,
  maxRows: 4,
  bottom: 36,
} as const;

/** 판 윗변에서 목록 윗변까지. */
export function runePickerListTop(): number {
  const g = RUNE_PICK_GRID;
  return g.controlsY - RUNE_LIST_CONTROLS.rowHeight / 2 + RUNE_LIST_CONTROLS.height + g.listGap;
}

/** 가방 판의 크기. `total`은 거르기 전의 룬 수다. `viewHeight`는 목록이 보이는 높이다. */
export function runePickerSize(total: number): { width: number; height: number; viewHeight: number } {
  const g = RUNE_PICK_GRID;
  const rows = Math.min(g.maxRows, Math.max(1, Math.ceil(total / g.columns)));
  const viewHeight = rows * g.cellHeight;
  return { width: g.columns * g.cellWidth + g.padX * 2, height: runePickerListTop() + viewHeight + g.bottom, viewHeight };
}

/** 목록이 이만큼 길 때 위로 끌 수 있는 한도(0 이하). */
export function runePickerMinScroll(shown: number, viewHeight: number): number {
  const g = RUNE_PICK_GRID;
  return Math.min(0, viewHeight - Math.ceil(shown / g.columns) * g.cellHeight);
}
