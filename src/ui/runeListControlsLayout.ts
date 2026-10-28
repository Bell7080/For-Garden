/**
 * 룬 목록 위 두 줄의 자리 — 위가 **필터 · 검색 · 정렬**(도감과 같은 순서), 아래가 **토글 줄 + 개수**.
 *
 * Phaser 없는 모듈이라 배치표·테스트가 같은 값을 읽는다. 두 줄의 높이는 같고(`rowHeight` — 토글 칩 높이)
 * `rowGap`만큼 떨어진다. `height`는 두 줄이 차지하는 전체 높이다.
 */
export const RUNE_LIST_CONTROLS = {
  rowHeight: 60, rowGap: 14, gap: 12,
  filterWidth: 84, sortWidth: 200, dirWidth: 60, fontSize: 24,
  height: 60 * 2 + 14,
} as const;
