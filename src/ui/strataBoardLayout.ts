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
export const STRATA_BOARD = { top: 360, bottom: 1280, maxWidth: 840, left: 24, baseShade: 0.32 } as const;

/**
 * 판 오른쪽에 서는 범례 띠. 안개 색이 무엇을 기울이는지 그림으로 말한다.
 *
 * 판이 화면 폭을 다 쓰던 때는 옆에 설 자리가 없었다 — 판 폭을 줄여 이 띠를 낸다. 세로는 판과
 * 같은 높이 띠 안에서 가운데에 서며, 색이 넷이어도 판의 가장 낮은 높이(840)를 넘지 않는다(제목 56 + 4 × 146 = 640).
 */
export const STRATA_LEGEND = { width: 176, gap: 16, titleHeight: 56, rowHeight: 146, icon: 50, swatch: 44 } as const;

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
  const regionLeft = STRATA_BOARD.left;
  const regionRight = screenWidth - STRATA_BOARD.left - STRATA_LEGEND.width - STRATA_LEGEND.gap;
  const roomWidth = Math.min(STRATA_BOARD.maxWidth, regionRight - regionLeft);
  const roomHeight = STRATA_BOARD.bottom - STRATA_BOARD.top;
  const cellSize = Math.min(roomWidth / safeColumns, roomHeight / safeRows);
  const width = cellSize * safeColumns;
  const height = cellSize * safeRows;
  return { width, height, centerX: (regionLeft + regionRight) / 2, centerY: STRATA_BOARD.top + roomHeight / 2, cellWidth: cellSize, cellHeight: cellSize };
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


/** 범례 띠의 화면 사각형이다. 세로는 판 옆에서 가운데에 선다. */
export interface StrataLegendFrame { left: number; centerX: number; width: number; top: number; height: number; rowTops: number[] }

/** 색이 `rowCount`개인 범례 띠의 자리를 구한다. 판이 다시 그려져도 같은 판이면 같은 자리다. */
export function strataLegendFrame(frame: StrataBoardFrame, rowCount: number, screenWidth: number): StrataLegendFrame {
  const width = STRATA_LEGEND.width;
  const left = screenWidth - STRATA_BOARD.left - width;
  const height = STRATA_LEGEND.titleHeight + Math.max(0, rowCount) * STRATA_LEGEND.rowHeight;
  const top = frame.centerY - height / 2;
  const rowTops = Array.from({ length: Math.max(0, rowCount) }, (_, row) => top + STRATA_LEGEND.titleHeight + row * STRATA_LEGEND.rowHeight);
  return { left, centerX: left + width / 2, width, top, height, rowTops };
}

/** 전리품 줄의 칸 자리와 크기다. 칸 수가 늘어도 화면 폭 안에서 서로 겹치지 않는다. */
export interface StrataHaulLayout { xs: number[]; frame: number }

/**
 * 전리품 칸이 `count`개일 때의 가로 자리.
 *
 * 룬은 등급마다, 연구 재료는 아이템마다 칸이 갈라져 칸 수가 재화 종류보다 많아질 수 있다. 칸 간격을
 * 화면 폭에서 거꾸로 구하고, 좁아지면 액자도 함께 줄여(하한 있음) 옆 칸을 덮지 않게 한다.
 */
export function strataHaulLayout(count: number, screenWidth: number, preferred = { frame: 116, gap: 152 }, margin = 40): StrataHaulLayout {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return { xs: [], frame: preferred.frame };
  const room = Math.max(0, screenWidth - margin * 2 - preferred.frame);
  const gap = n <= 1 ? preferred.gap : Math.min(preferred.gap, room / (n - 1));
  const frame = Math.max(72, Math.min(preferred.frame, gap - 6));
  const start = screenWidth / 2 - ((n - 1) * gap) / 2;
  return { xs: Array.from({ length: n }, (_, index) => start + index * gap), frame };
}

/**
 * 발굴판 무대의 장식 자리.
 *
 * 판에는 이미 두 겹의 테두리(굵은 바깥선 + 안쪽 가는 선)와 그림자가 있고, 옆에는 범례 판과 위에는 굴착
 * 게이지 판이 선다. 무대의 모서리 표식을 그 위에 그대로 얹으면(판 왼쪽 위를 표식 하나가 가로지르던 때가
 * 있었다) 장식끼리 겹쳐 지저분하다. 그래서 **표식은 판 테두리 바깥, 범례·게이지 판 사이의 빈 띠에만** 앉힌다.
 */
export const STRATA_STAGE = {
  /** 판 바깥 테두리(굵은 선 + 선 굵기의 반)가 판 가장자리에서 밖으로 나가는 거리. */
  frameOuter: 12,
  /** 표식 줄기의 길이와 굵기, 무대 가장자리에서 안쪽으로 들어간 거리. */
  bracketReach: 40, bracketStroke: 4, bracketInset: 4,
  /** 판 윗변·밑변에서 무대 가장자리까지. 표식의 가로줄이 판 테두리와 떨어질 만큼이다. */
  marginY: 32,
  /** 굴착 게이지 판이 무대 위로 튀어나오지 않도록 비워 두는 띠. */
  gap: 2,
} as const;

export interface StrataStageFrame {
  left: number; right: number; top: number; bottom: number;
  /** 표식 네 곳: 꺾이는 점과 두 줄기가 뻗는 방향(±1). */
  brackets: Array<{ x: number; y: number; dx: 1 | -1; dy: 1 | -1 }>;
}

/** 무대의 사각형과 표식 자리. 화면 가장자리에 붙어 판·범례와 어떤 장식도 겹치지 않는다. */
export function strataStageFrame(frame: StrataBoardFrame, screenWidth: number): StrataStageFrame {
  const left = 0; const right = screenWidth;
  const top = frame.centerY - frame.height / 2 - STRATA_STAGE.marginY;
  const bottom = frame.centerY + frame.height / 2 + STRATA_STAGE.marginY;
  const x0 = left + STRATA_STAGE.bracketInset; const x1 = right - STRATA_STAGE.bracketInset;
  const y0 = top + STRATA_STAGE.bracketInset; const y1 = bottom - STRATA_STAGE.bracketInset;
  return { left, right, top, bottom, brackets: [
    { x: x0, y: y0, dx: 1, dy: 1 }, { x: x1, y: y0, dx: -1, dy: 1 },
    { x: x0, y: y1, dx: 1, dy: -1 }, { x: x1, y: y1, dx: -1, dy: -1 },
  ] };
}

/** 표식 한 곳이 차지하는 상자 둘 — 가로 줄기와 세로 줄기. 「ㄱ」 자라 묶음 상자로 재면 빈 모서리까지 겹쳐 센다. */
export function strataBracketBoxes(bracket: StrataStageFrame["brackets"][number]): Array<{ left: number; right: number; top: number; bottom: number }> {
  const half = STRATA_STAGE.bracketStroke / 2; const reach = STRATA_STAGE.bracketReach;
  const span = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];
  const [hl, hr] = span(bracket.x - half, bracket.x + bracket.dx * reach);
  const [vt, vb] = span(bracket.y - half, bracket.y + bracket.dy * reach);
  return [
    { left: hl, right: hr, top: bracket.y - half, bottom: bracket.y + half },
    { left: bracket.x - half, right: bracket.x + half, top: vt, bottom: vb },
  ];
}
