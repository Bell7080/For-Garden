import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 상점 화면의 자리표.
 *
 * **위는 점원이 선 무대, 아래는 상품을 얹어 둔 전시대다.** 예전에는 점원 전신이 왼쪽 430px를
 * 통째로 쓰고 목록이 그 오른쪽 610px에 세로로 한 줄씩 섰는데, 세로 화면에서 한 줄짜리 목록은
 * 카드 하나가 가로로 길어 액자·이름·설명·값이 한 줄에 늘어서고 그만큼 한 번에 두 개밖에
 * 보이지 않았다.
 *
 * 값은 화면이 손으로 적지 않고 이 표와 아래 함수에서만 나온다 —
 * `tests/unit/shopLayout.test.ts`가 무대·전시대·격자·탭이 서로를 침범하지 않는지 지킨다.
 */

/** 상단 재화 줄이 지키는 띠. 점원의 머리끝이 이 아래에서 시작한다. */
export const SHOP_TOPBAR_GUARD = 150;

/**
 * 위 무대 — 오른쪽에 점원, 왼쪽에 대사.
 *
 * **무대 바닥선(`bottom`) 하나가 이 화면의 유일한 손잡이다.** 전시대의 윗변도, 점원이 잘리는
 * 자리도, 격자가 시작하는 높이도 전부 이 값에서 나온다.
 */
export const SHOP_STAGE = {
  top: 0,
  /**
   * 무대 바닥선.
   *
   * **화면의 삼분의 일보다 조금 더 준다.** 넷으로 나눠 한 칸(480)만 주었을 때는 점원이 어깨
   * 언저리에서 잘려 누구인지만 겨우 읽혔다 — 허리께까지 보여야 그 자리에 사람이 서 있는 것으로
   * 읽힌다.
   */
  bottom: 700,
  /**
   * 점원은 **머리 관절**을 기준으로 세운다. 전신 높이로 발끝을 맞추면 등신이 다른 원화마다
   * 얼굴이 다른 자리에 서므로, 머리를 무대에 고정하고 남는 몸은 전시대가 가린다.
   *
   * **머리끝이 상단 재화 줄 아래에서 시작해야 한다**(`SHOP_TOPBAR_GUARD`) — 더 올리면 모자·뿔이
   * 재화 칸을 침범해, 지금 얼마인지를 읽는 줄 위에 그림이 겹친다.
   */
  merchant: { headX: 790, headY: 360, height: 1200 },
  /** 대사는 왼쪽. 이름줄과 대사줄만 덮는 얇은 띠라 무대 배경이 그대로 보인다. */
  dialogue: { centerX: 340, centerY: 500, width: 588, height: 168, nameOffsetY: -46, lineOffsetY: 22 },
} as const;

/**
 * 상품을 얹어 둔 **전시대** — 화면 좌우와 밑동까지 쓴다.
 *
 * 무대 바닥선보다 한 뼘 위에서 시작해 점원의 허리를 가린다 — 경계에서 딱 맞추면 잘린 몸통이
 * 윗변에 붙어 "덜 그려진 것"처럼 보인다.
 *
 * **사방에 여백을 남기지 않는다.** 36px 띠를 좌우에, 236px를 밑에 두었을 때는 그 자리에
 * 아무것도 서지 않으면서 칸만 좁혔다 — 세로 화면에서 가장 아쉬운 것이 칸 폭이다. 판이 화면
 * 밑동까지 내려가므로 **목록 교체 줄도 판 안**에 서고, 그 줄은 우하단 뒤로가기를 피해 왼쪽에
 * 붙는다.
 */
export const SHOP_BOARD = {
  left: 0,
  right: BASE_WIDTH,
  top: SHOP_STAGE.bottom - 10,
  bottom: BASE_HEIGHT,
  /** 글과 칸이 판 좌우 변에서 들어오는 여백. */
  padX: 30,
  /** 격자가 흐르는 창이 전시대 윗변에서 내려오는 여백. 제목표가 그 사이에 걸터앉는다. */
  viewportTopPad: 100,
  /** 창 밑변이 목록 교체 줄에서 물러나는 여백. */
  viewportTabGap: 22,
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
  height: 390,
  frame: 170,
  frameY: -95,
  nameY: 38,
  remainingY: 82,
  price: { y: 148, height: 66, inset: 56 },
  /** 드래그와 탭을 가르는 거리. 이보다 많이 밀렸으면 스크롤이지 구매가 아니다. */
  dragSlop: 16,
} as const;

/**
 * 하단 목록 교체 줄 — 가방과 같은 서류철 라벨이다.
 *
 * 판이 화면 밑동까지 내려오므로 **판 안**의 밑동에 서고, 우하단 뒤로가기를 피해 **왼쪽에
 * 붙는다** — 가운데에 세우면 마지막 라벨이 그 버튼 밑으로 들어간다.
 */
export const SHOP_TAB_ROW = { width: 176, height: 82, gap: 8, left: 30, bottom: BASE_HEIGHT - 26 } as const;

/**
 * 줄마다 깔리는 **선반 한 장**.
 *
 * 칸만 떠 있으면 목록이고, 그 밑에 선반이 지나가면 전시대가 된다 — 상품이 놓여 있는 것으로
 * 읽히게 하는 것이 이 한 줄의 몫이다. 선반은 칸과 함께 흐르므로 격자 컨테이너 안에 둔다.
 */
export const SHOP_SHELF = { height: 18, offsetY: 10, overhang: 14 } as const;

/**
 * 격자 위에 서는 **제목표**의 자리.
 *
 * **머리글은 맨 글자가 아니라 제목표다.** `교환 목록`을 판 위에 그냥 적고 아래에 구분선을
 * 하나 그었을 때는, 같은 위계의 글이 다른 화면에서는 판에 걸터앉고 여기서만 맨 글자로 섰다.
 * 지금은 화면 어디서나 쓰는 `addSectionTitle` 한 장이다.
 *
 * **뒤에 판을 받치지 않는다.** 창보다 넓은 어두운 살피를 한 겹 깔아 봤는데, 선반이 이미 줄마다
 * 깊이를 만들고 있어 그 위에 판이 하나 더 생기는 것으로만 보였다 — 제목표가 제 판을 이미
 * 갖고 있어 받칠 것도 없다.
 */
export const SHOP_TITLE = {
  /** 제목표 글자 크기. 표의 높이도 이 값을 따라간다. */
  size: 34,
  /** 창 윗변에서 얼마나 위에 걸터앉는지. */
  liftFromViewport: 26,
} as const;

/** 제목표가 걸터앉는 높이. 격자 창 바로 위다. */
export function shopTitleY(): number {
  return shopGridViewport().top - SHOP_TITLE.liftFromViewport;
}

/** 제목표의 왼쪽 끝. 칸 줄과 같은 시작선을 쓴다. */
export function shopTitleLeft(): number {
  return shopGridViewport().left;
}

/** 그 줄의 선반이 지나가는 y. 칸 밑변 바로 아래라 칸이 선반에 놓인 것으로 읽힌다. */
export function shopShelfY(row: number): number {
  return shopCardSpot(row * SHOP_CARD.columns).y + SHOP_CARD.height / 2 + SHOP_SHELF.offsetY;
}

/** 선반 한 장의 폭. 칸 줄보다 조금 더 내밀어 칸이 선반 **위에** 선 것으로 보인다. */
export function shopShelfWidth(): number {
  const view = shopGridViewport();
  return view.right - view.left + SHOP_SHELF.overhang * 2;
}

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
    bottom: SHOP_TAB_ROW.bottom - SHOP_TAB_ROW.height - SHOP_BOARD.viewportTabGap,
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

/** 탭 한 장의 중심. 판 안 밑동의 왼쪽에서 오른쪽으로 이어진다. */
export function shopTabSpot(index: number): { x: number; y: number } {
  const { width, height, gap, left, bottom } = SHOP_TAB_ROW;
  return { x: left + width / 2 + index * (width + gap), y: bottom - height / 2 };
}
