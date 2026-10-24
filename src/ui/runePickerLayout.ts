/**
 * 합성·특성 연구가 룬을 고르는 가방의 격자.
 *
 * 정보창의 장착용 가방과 같은 규격·같은 보기 토글(`settings.game.runeBag`)을 쓴다. 다만 이쪽은 어느 자리의
 * 룬이든 늘어놓는 가방이라 길어지기 쉬워, 한 쪽에 `rowsPerPage` 줄까지만 세우고 아래 쪽 넘김이 나머지를 맡는다.
 * 판 높이는 거르기 전의 수로 정해 토글을 눌러도 판이 줄었다 늘지 않는다.
 */
export const RUNE_PICK_GRID = {
  columns: 4, cardWidth: 180, cardHeight: 180, cellWidth: 208, cellHeight: 208,
  padX: 48, headerHeight: 220, toggleY: 82, rowsPerPage: 4, footerHeight: 100,
} as const;

/** 가방 판의 크기. `total`은 거르기 전의 룬 수다. */
export function runePickerSize(total: number): { width: number; height: number; perPage: number } {
  const g = RUNE_PICK_GRID;
  const perPage = g.columns * g.rowsPerPage;
  const rows = Math.min(g.rowsPerPage, Math.max(1, Math.ceil(total / g.columns)));
  const footer = total > perPage ? g.footerHeight : 0;
  return {
    width: g.columns * g.cellWidth + g.padX * 2,
    height: g.headerHeight + (rows - 1) * g.cellHeight + g.cardHeight / 2 + 48 + footer,
    perPage,
  };
}
