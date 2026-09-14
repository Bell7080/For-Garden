/**
 * 지층 탐사판의 순수 배치표다.
 *
 * Phaser를 모르는 곳에 두는 이유는 화면과 회귀 테스트가 **같은 값**을 읽어야 하기 때문이다.
 * 칸 크기를 화면에서 눈대중으로 정하면 판이 5×5에서 6×5로 늘 때 판 밖으로 나간다.
 *
 * **판은 원화 한 장이고 칸은 그 원화를 자른 조각이다.** 칸마다 판때기를 그리지 않는다 —
 * 홀로그램 칸을 깔면 그 위에 흙 그림이 얹힌 것으로 보이지, 흙을 파는 것으로 보이지 않는다.
 * 칸 사이에 틈도 두지 않는다. 틈이 있으면 땅이 아니라 타일 바닥이 된다.
 */

/** 겉장·아래층 원화의 원본 크기(px). 자르는 자리를 이 좌표계에서 잰다. */
export const STRATA_ART = { width: 941, height: 1672 } as const;

/** 판이 놓이는 자리. 제목 줄 아래에서 라벨 줄 위까지의 띠다. */
export const STRATA_BOARD = {
  /** 판 윗변이 놓이는 화면 y. 제목·횟수 줄 아래다. */
  top: 330,
  /** 판 밑변이 놓이는 화면 y. 좌하단 라벨 줄 위에서 끊는다. */
  bottom: 1580,
  /** 판이 쓸 수 있는 최대 폭. 세로 화면 좌우에 손가락이 지나갈 자리를 남긴다. */
  maxWidth: 1000,
  /** 아래층 위에 까는 어둠. 부순 칸이 겉장보다 **가라앉아 보이게** 하는 몫이다. */
  baseShade: 0.32,
} as const;

/** 판 하나의 실제 크기와 화면 자리다. 원화 비율을 지켜 찌그러뜨리지 않는다. */
export interface StrataBoardFrame {
  /** 화면에 그릴 판의 크기. */
  width: number;
  height: number;
  /** 판 가운데의 화면 좌표. */
  centerX: number;
  centerY: number;
  /** 칸 하나의 크기(화면 px). */
  cellWidth: number;
  cellHeight: number;
}

/**
 * 칸 수에서 판의 크기와 자리를 구한다.
 *
 * **원화 비율을 지킨다** — 자리에 맞춰 늘이면 흙 결이 세로로 뭉개진다. 자리보다 원화가 길면
 * 높이에 맞추고, 넓으면 폭에 맞춘다.
 */
export function strataBoardFrame(columns: number, rows: number, screenWidth: number): StrataBoardFrame {
  const room = { width: Math.min(STRATA_BOARD.maxWidth, screenWidth), height: STRATA_BOARD.bottom - STRATA_BOARD.top };
  const scale = Math.min(room.width / STRATA_ART.width, room.height / STRATA_ART.height);
  const width = STRATA_ART.width * scale;
  const height = STRATA_ART.height * scale;
  return {
    width,
    height,
    centerX: screenWidth / 2,
    centerY: STRATA_BOARD.top + room.height / 2,
    cellWidth: width / Math.max(1, columns),
    cellHeight: height / Math.max(1, rows),
  };
}

/**
 * 판 가운데를 원점으로 한 칸 하나의 중심이다.
 *
 * 줄 수는 이미 `frame.cellHeight`에 들어 있어 여기서 다시 읽지 않는다 — 두 곳이 따로 나누면
 * 판을 5×5에서 6×5로 늘릴 때 한쪽만 고쳐도 칸이 어긋난 채 돌아간다.
 */
export function strataTileCenter(index: number, columns: number, frame: StrataBoardFrame): { x: number; y: number } {
  return {
    x: -frame.width / 2 + frame.cellWidth * ((index % columns) + 0.5),
    y: -frame.height / 2 + frame.cellHeight * (Math.floor(index / columns) + 0.5),
  };
}

/**
 * 그 칸이 덮는 **원화 안의 자리**(원본 px).
 *
 * 조각을 따로 만들지 않고 같은 원화를 칸마다 잘라 쓰기 때문에, 화면이 아니라 원본 좌표로
 * 잰다 — 원화를 더 크게 다시 구워도 이 표는 그대로다.
 */
export function strataTileCrop(index: number, columns: number, rows: number): { x: number; y: number; width: number; height: number } {
  const width = STRATA_ART.width / Math.max(1, columns);
  const height = STRATA_ART.height / Math.max(1, rows);
  return { x: width * (index % columns), y: height * Math.floor(index / columns), width, height };
}

/** 겉장 원화의 텍스처 키. 판이 들고 있는 번호가 곧 이 이름이다. */
export function strataLayerTextureKey(art: number): string {
  return `background-strata-layer-${String(Math.max(1, Math.floor(art))).padStart(3, "0")}`;
}
