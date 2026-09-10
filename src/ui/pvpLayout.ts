/** PvP 화면의 복귀 목적지는 테스트와 씬이 함께 읽어 문자열이 엇갈리지 않게 한다. */
export const PVP_RETURN_SCENE = { selection: "lobby", preview: "pvp" } as const;

/** Phaser와 무관한 한 선택 칸의 중심 좌표와 정사각형 입력 영역이다. */
export interface PvpGridCell { x: number; y: number; width: number; height: number }

/** 1080×1920 세로 화면에서 상단 바와 뒤로가기 안전 영역 사이에 놓이는 2×2 배치 기준이다. */
export const PVP_GRID = { columns: 2, rows: 2, cellSize: 390, gapX: 54, gapY: 54, centerX: 540, centerY: 940 } as const;

/** 읽기 순서의 인덱스를 2×2 중심 좌표로 바꾸며 입력 폭·높이를 항상 동일하게 유지한다. */
export function pvpGridCell(index: number): PvpGridCell {
  const column = index % PVP_GRID.columns;
  const row = Math.floor(index / PVP_GRID.columns);
  const stepX = PVP_GRID.cellSize + PVP_GRID.gapX;
  const stepY = PVP_GRID.cellSize + PVP_GRID.gapY;
  return {
    x: PVP_GRID.centerX + (column - 0.5) * stepX,
    y: PVP_GRID.centerY + (row - 0.5) * stepY,
    width: PVP_GRID.cellSize,
    height: PVP_GRID.cellSize,
  };
}
