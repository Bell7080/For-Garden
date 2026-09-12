import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 상점 화면의 자리표.
 *
 * **화면을 넷으로 나눠 위 한 칸은 무대, 아래 세 칸은 상품 판이다.** 예전에는 점원 전신이
 * 왼쪽 430px를 통째로 쓰고 목록이 그 오른쪽 610px에 세로로 한 줄씩 섰는데, 세로 화면에서
 * 한 줄짜리 목록은 카드 하나가 가로로 길어 액자·이름·설명·값이 한 줄에 늘어서고 그만큼
 * 한 번에 두 개밖에 보이지 않았다. 점원은 무대 한 칸에서 **상반신만** 서고 목록은 화면 폭을
 * 다 쓰는 두 줄 격자가 된다.
 *
 * 값은 화면이 손으로 적지 않고 이 표와 아래 함수에서만 나온다 —
 * `tests/unit/shopLayout.test.ts`가 무대·판·격자·탭이 서로를 침범하지 않는지 지킨다.
 */
export const SHOP_QUARTER = BASE_HEIGHT / 4;

/** 위 한 칸 — 오른쪽에 점원, 왼쪽에 대사. */
export const SHOP_STAGE = {
  top: 0,
  bottom: SHOP_QUARTER,
  /**
   * 점원은 **머리 관절**을 기준으로 세운다. 전신 높이로 발끝을 맞추면 등신이 다른 원화마다
   * 얼굴이 다른 자리에 서므로, 머리를 무대에 고정하고 남는 몸은 상품 판이 가린다.
   */
  merchant: { headX: 790, headY: 306, height: 1080 },
  /** 대사는 왼쪽. 이름줄과 대사줄만 덮는 얇은 띠라 무대 배경이 그대로 보인다. */
  dialogue: { centerX: 340, centerY: 352, width: 588, height: 168, nameOffsetY: -46, lineOffsetY: 22 },
} as const;

/**
 * 아래 세 칸을 덮는 상품 판.
 *
 * 무대 바닥선보다 한 뼘 위에서 시작해 점원의 허리를 가린다 — 경계에서 딱 맞추면 잘린 몸통이
 * 판 윗변에 붙어 "덜 그려진 것"처럼 보인다.
 */
export const SHOP_BOARD = {
  left: 36,
  right: BASE_WIDTH - 36,
  top: SHOP_QUARTER - 10,
  bottom: BASE_HEIGHT - 236,
  /** 글과 칸이 판 좌우 변에서 들어오는 여백. */
  padX: 30,
  /** 머리글 한 줄과 그 아래 구분선의 판 윗변 기준 높이. */
  headerY: 44,
  hairlineY: 82,
  /** 격자가 흐르는 창이 머리글 아래에서 시작해 판 밑변 앞에서 끊기는 여백. */
  viewportTopPad: 100,
  viewportBottomPad: 26,
} as const;

/**
 * 상품 칸 한 장.
 *
 * 두 줄로 서므로 가로로 늘어놓을 수 없다 — 액자가 위에 서고 이름·남은 교환·값 줄이 그 아래로
 * 쌓인다. 값은 액자가 아니라 **가로로 긴 줄**(`addPriceBar`)이다: 칸마다 값이 하나뿐이라
 * 작은 네모로 두면 칸 구석에 외따로 뜬 조각으로 읽힌다.
 */
export const SHOP_CARD = {
  columns: 2,
  gapX: 24,
  gapY: 24,
  /**
   * 칸 높이.
   *
   * **세 줄이 창보다 조금 길다.** 딱 맞게 두면 일반 탭의 다섯 상품이 한 화면에 들어와 목록이
   * 흐르지 않고, 그 탭만 스크롤이 없는 화면이 된다 — 탭마다 손짓이 갈리면 목록을 끝까지 봤는지
   * 알 수 없다.
   */
  height: 360,
  frame: 160,
  frameY: -88,
  nameY: 28,
  remainingY: 70,
  price: { y: 132, height: 64, inset: 56 },
  /** 드래그와 탭을 가르는 거리. 이보다 많이 밀렸으면 스크롤이지 구매가 아니다. */
  dragSlop: 16,
} as const;

/** 하단 목록 교체 줄 — 가방과 같은 서류철 라벨이다. */
export const SHOP_TAB_ROW = { width: 176, height: 82, gap: 8, overlap: 8 } as const;

export interface ShopRect { left: number; right: number; top: number; bottom: number }

/** 판이 실제로 차지하는 폭과 높이. 화면이 좌우 변에서 빼지 않는다. */
export function shopBoardSize(): { width: number; height: number; centerX: number; centerY: number } {
  const width = SHOP_BOARD.right - SHOP_BOARD.left;
  const height = SHOP_BOARD.bottom - SHOP_BOARD.top;
  return { width, height, centerX: (SHOP_BOARD.left + SHOP_BOARD.right) / 2, centerY: (SHOP_BOARD.top + SHOP_BOARD.bottom) / 2 };
}

/** 격자가 흐르는 창. 마스크와 입력 경계가 같은 값을 읽는다. */
export function shopGridViewport(): ShopRect {
  return {
    left: SHOP_BOARD.left + SHOP_BOARD.padX,
    right: SHOP_BOARD.right - SHOP_BOARD.padX,
    top: SHOP_BOARD.top + SHOP_BOARD.viewportTopPad,
    bottom: SHOP_BOARD.bottom - SHOP_BOARD.viewportBottomPad,
  };
}

/** 칸 하나의 폭. 두 칸과 그 사이 간격이 창을 정확히 나눠 갖는다. */
export function shopCardWidth(): number {
  const view = shopGridViewport();
  return (view.right - view.left - SHOP_CARD.gapX * (SHOP_CARD.columns - 1)) / SHOP_CARD.columns;
}

/** 스크롤 0일 때 그 칸의 중심. 화면은 여기에 컨테이너 이동만 더한다. */
export function shopCardSpot(index: number): { x: number; y: number } {
  const view = shopGridViewport();
  const width = shopCardWidth();
  const column = index % SHOP_CARD.columns;
  const row = Math.floor(index / SHOP_CARD.columns);
  return {
    x: view.left + width / 2 + column * (width + SHOP_CARD.gapX),
    y: view.top + SHOP_CARD.height / 2 + row * (SHOP_CARD.height + SHOP_CARD.gapY),
  };
}

/** 그 수만큼의 칸이 쌓인 높이. 창보다 길면 그 안에서 흐른다. */
export function shopGridContentHeight(count: number): number {
  if (count <= 0) return 0;
  const rows = Math.ceil(count / SHOP_CARD.columns);
  return rows * (SHOP_CARD.height + SHOP_CARD.gapY) - SHOP_CARD.gapY;
}

/**
 * 탭 한 장의 중심.
 *
 * 판 **밑변에 걸터앉아** 서류철 라벨처럼 조금 물려 선다 — 떼어 놓으면 판과 무관한 버튼 줄로
 * 읽히고, 완전히 겹치면 판 안의 격자와 같은 층이 된다.
 */
export function shopTabSpot(index: number, count: number): { x: number; y: number } {
  const { width, height, gap, overlap } = SHOP_TAB_ROW;
  const rowWidth = count * width + (count - 1) * gap;
  const { centerX } = shopBoardSize();
  return { x: centerX - rowWidth / 2 + width / 2 + index * (width + gap), y: SHOP_BOARD.bottom + height / 2 - overlap };
}
