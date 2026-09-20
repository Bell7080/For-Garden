/**
 * 지층 탐사판의 순수 배치표다.
 *
 * 화면 칸은 정사각 격자이고, 원화는 그 격자 뒤에서 `cover`로 잘린 한 장이다. 화면 좌표와 원본
 * 이미지 좌표를 같은 사각형 타입으로 넘기지 않아, 원화를 다시 구워도 입력 칸이 어긋나지 않는다.
 */

/** 겉장·아래층 원화의 원본 크기(px). */
export const STRATA_ART = { width: 941, height: 1672 } as const;

/**
 * 판이 놓일 수 있는 화면 좌표의 띠다.
 *
 * **밑변을 1580에서 1280으로 올렸다.** 판 아래에 전리품 액자 줄과 그 아래 「탐사 종료」가
 * 서야 하는데, 판이 1580까지 내려오던 때는 그 둘이 설 자리가 하단 라벨 줄(1652)과 겹쳤다.
 */
export const STRATA_BOARD = { top: 360, bottom: 1280, maxWidth: 1000, baseShade: 0.32 } as const;

/** 화면에 그리는 판과 셀의 좌표/크기다. 값의 단위는 모두 화면 px이다. */
export interface StrataBoardFrame {
  width: number; height: number; centerX: number; centerY: number; cellWidth: number; cellHeight: number;
}

/** 원본 이미지 안에서만 쓰는 크롭 사각형이다. 화면 좌표를 이 타입에 넣지 않는다. */
export interface SourceCropRect { x: number; y: number; width: number; height: number }

/** 원본을 목표 사각형에 비율 보존 `cover`로 채울 때 남길 원본 영역(px)을 구한다. */
export function coverSourceCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): SourceCropRect {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const targetRatio = Math.max(1, targetWidth) / Math.max(1, targetHeight);
  const sourceRatio = safeSourceWidth / safeSourceHeight;
  if (sourceRatio > targetRatio) {
    const width = safeSourceHeight * targetRatio;
    return { x: (safeSourceWidth - width) / 2, y: 0, width, height: safeSourceHeight };
  }
  const height = safeSourceWidth / targetRatio;
  return { x: 0, y: (safeSourceHeight - height) / 2, width: safeSourceWidth, height };
}

/** 가용 폭/열과 가용 높이/행 중 작은 값을 셀 한 변으로 삼아 정사각 격자를 만든다. */
export function strataBoardFrame(columns: number, rows: number, screenWidth: number): StrataBoardFrame {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const roomWidth = Math.min(STRATA_BOARD.maxWidth, screenWidth);
  const roomHeight = STRATA_BOARD.bottom - STRATA_BOARD.top;
  const cellSize = Math.min(roomWidth / safeColumns, roomHeight / safeRows);
  const width = cellSize * safeColumns;
  const height = cellSize * safeRows;
  return { width, height, centerX: screenWidth / 2, centerY: STRATA_BOARD.top + roomHeight / 2, cellWidth: cellSize, cellHeight: cellSize };
}

/** 판 컨테이너의 중심을 원점으로 한 화면 셀 중심이다. */
export function strataTileCenter(index: number, columns: number, frame: StrataBoardFrame): { x: number; y: number } {
  return { x: -frame.width / 2 + frame.cellWidth * ((index % columns) + 0.5), y: -frame.height / 2 + frame.cellHeight * (Math.floor(index / columns) + 0.5) };
}

/** `coverSourceCrop`이 남긴 원본 영역을 격자 한 칸만큼 나눈다. 반환값은 계속 원화 px이다. */
export function strataTileCrop(index: number, columns: number, rows: number, sourceCrop: SourceCropRect = coverSourceCrop(STRATA_ART.width, STRATA_ART.height, columns, rows)): SourceCropRect {
  const width = sourceCrop.width / Math.max(1, columns);
  const height = sourceCrop.height / Math.max(1, rows);
  return { x: sourceCrop.x + width * (index % columns), y: sourceCrop.y + height * Math.floor(index / columns), width, height };
}

/** 겉장 원화의 텍스처 키는 서버가 고른 번호에서만 만든다. */
export function strataLayerTextureKey(art: number): string {
  return `background-strata-layer-${String(Math.max(1, Math.floor(art))).padStart(3, "0")}`;
}

/** 화면에 세울 사각형이다. 단위는 화면 px이고 중심을 기준으로 잡는다. */
export interface ScreenRect { centerX: number; centerY: number; width: number; height: number }

/** 잘라낸 원본 영역을 화면 사각형에 꽉 채울 때의 배율과 위치다. */
export interface CropPlacement { x: number; y: number; scaleX: number; scaleY: number }

/**
 * **잘라낸 조각은 `setDisplaySize`로 칸에 맞출 수 없다.** Phaser의 crop은 남길 원본 영역만
 * 고를 뿐 원점을 **원화 전체**에 그대로 두므로, 표시 크기를 칸 한 변으로 주면 원화 한 장이
 * 칸만 하게 줄고 그 안에서 조각 하나만 남아 칸 구석에 작은 그림이 뜬다 — 칸마다 다른 자리가
 * 남아 서로 무관한 그림이 하나씩 놓인 것으로 읽힌다. 그래서 배율은 **조각 크기**에서 구하고
 * 위치는 원화 중심이 있어야 할 자리로 되민다. 그러면 스물다섯 칸이 배경 한 장을 나눠 깐다.
 */
export function strataCropPlacement(
  crop: SourceCropRect,
  target: ScreenRect,
  sourceWidth: number = STRATA_ART.width,
  sourceHeight: number = STRATA_ART.height,
): CropPlacement {
  const scaleX = target.width / Math.max(1, crop.width);
  const scaleY = target.height / Math.max(1, crop.height);
  return {
    x: target.centerX - target.width / 2 + scaleX * (sourceWidth / 2 - crop.x),
    y: target.centerY - target.height / 2 + scaleY * (sourceHeight / 2 - crop.y),
    scaleX,
    scaleY,
  };
}
