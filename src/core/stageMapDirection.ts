/** 감금동 진입 지도는 위에서 아래로 내려가며, 나머지 지도는 아래에서 위로 진행한다. */
export function stageMapRow(chapter: number, row: number, rowCount: number): number {
  return chapter === 5 || chapter === 6 ? rowCount - 1 - row : row;
}
