/** 감금동 진입 지도는 위에서 아래로 내려가며, 나머지 지도는 아래에서 위로 진행한다. */
export function stageMapRow(chapter: number, row: number, rowCount: number): number {
  return isDescendingChapter(chapter) ? rowCount - 1 - row : row;
}

/** 위에서 아래로 내려가는 지도인가. 처음 그 지도를 열 때 코마가 방향을 짚어 준다(첫 방문 안내 `descendingMap`). */
export function isDescendingChapter(chapter: number): boolean {
  return chapter === 5 || chapter === 6;
}
