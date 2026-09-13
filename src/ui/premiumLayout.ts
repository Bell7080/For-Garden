import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
// 하단 탭의 윗변. `BottomNav`가 아니라 순수 표에서 읽어 이 자리표가 Phaser를 들여오지 않는다.
import { LOBBY_NAV_TOP } from "./lobbyLayout";

/**
 * 프리미엄 화면의 자리표.
 *
 * **상점과 같은 문법이다** — 목록이 위, 목록을 갈아 끼우는 서류철 라벨이 아래다. 다른 점은
 * 하단 탭(고고학·렐릭·로비·연구소·프리미엄)이 화면 밑동을 이미 차지하고 있다는 것뿐이라,
 * 라벨 줄은 그 위에 선다.
 *
 * 값은 화면이 손으로 적지 않고 이 표와 아래 함수에서만 나온다 —
 * `tests/unit/premiumLayout.test.ts`가 창·격자·라벨 줄이 서로를 침범하지 않는지 지킨다.
 */
export const PREMIUM_BOARD = {
  left: 0,
  right: BASE_WIDTH,
  /** 제목줄 아래. 제목표가 이 변에 걸터앉는다. */
  top: 268,
  padX: 30,
  /** 격자가 흐르는 창이 판 윗변에서 내려오는 여백. 제목표의 아래 절반이 그 사이에 든다. */
  viewportTopPad: 62,
  /** 창 밑변이 목록 교체 줄에서 물러나는 여백. */
  viewportTabGap: 22,
} as const;

/** 제목표 글자 크기. 상점의 `교환 목록`과 같은 위계다. */
export const PREMIUM_TITLE = { size: 34 } as const;

/**
 * 목록 교체 줄 — 상점·가방과 같은 서류철 라벨이다.
 *
 * 넷이 나란히 서므로 칸이 상점(셋)보다 좁다. 하단 탭 바로 위에 서고, 우하단에는 뒤로가기가
 * 없는 화면이라(하단 탭이 그 몫을 한다) 왼쪽에 붙이지 않고 화면 폭을 고르게 나눈다.
 */
export const PREMIUM_TAB_ROW = { width: 232, height: 82, gap: 8, bottom: LOBBY_NAV_TOP - 22 } as const;

/**
 * 상품 칸 한 장.
 *
 * **두 줄 격자다.** 한 줄에 하나씩 눕히던 때는 카드가 가로로 길어 이름·설명·값이 한 줄에
 * 늘어섰고 세로 화면에 네 개밖에 서지 못했다 — 젬 갈래만 해도 넷이라 한 화면이 꽉 찬다.
 */
export const PREMIUM_CARD = {
  columns: 2,
  gapX: 24,
  gapY: 24,
  /**
   * 칸 높이.
   *
   * **세 줄이 창보다 조금 길다.** 딱 맞게 두면 상품이 여섯인 갈래가 한 화면에 들어와 목록이
   * 흐르지 않고, 그 라벨만 스크롤이 없는 화면이 된다 — 라벨마다 손짓이 갈리면 목록을 끝까지
   * 봤는지 알 수 없다.
   */
  height: 420,
  frame: 168,
  frameY: -110,
  nameY: -6,
  /** 설명은 위쪽을 기준으로 쌓인다. 줄 수가 상품마다 다르기 때문이다. */
  noteY: 24,
  price: { y: 140, height: 66, inset: 56 },
  /** 남은 구매 횟수·결제 불가 사유. 값줄 아래 칸 밑동에 한 줄로 선다. */
  remainingY: 192,
  /** 드래그와 탭을 가르는 거리. 이보다 많이 밀렸으면 스크롤이지 구매가 아니다. */
  dragSlop: 16,
} as const;

export interface PremiumRect { left: number; right: number; top: number; bottom: number }

/** 격자가 흐르는 창. 마스크와 입력 경계가 같은 값을 읽는다. */
export function premiumGridViewport(): PremiumRect {
  return {
    left: PREMIUM_BOARD.left + PREMIUM_BOARD.padX,
    right: PREMIUM_BOARD.right - PREMIUM_BOARD.padX,
    top: PREMIUM_BOARD.top + PREMIUM_BOARD.viewportTopPad,
    bottom: PREMIUM_TAB_ROW.bottom - PREMIUM_TAB_ROW.height - PREMIUM_BOARD.viewportTabGap,
  };
}

/** 제목표 한 장의 높이. `addSectionTitle`이 글자 크기에서 잡는 값과 같다. */
export function premiumTitleHeight(): number {
  return Math.round(PREMIUM_TITLE.size * 1.52);
}

/** 제목표가 걸터앉는 높이와 왼쪽 끝. 칸 줄과 같은 시작선을 쓴다. */
export function premiumTitleY(): number { return PREMIUM_BOARD.top; }
export function premiumTitleLeft(): number { return premiumGridViewport().left; }

/** 칸 하나의 폭. 두 칸과 그 사이 간격이 창을 정확히 나눠 갖는다. */
export function premiumCardWidth(): number {
  const view = premiumGridViewport();
  return (view.right - view.left - PREMIUM_CARD.gapX * (PREMIUM_CARD.columns - 1)) / PREMIUM_CARD.columns;
}

/** 스크롤 0일 때 그 칸의 중심. 화면은 여기에 컨테이너 이동만 더한다. */
export function premiumCardSpot(index: number): { x: number; y: number } {
  const view = premiumGridViewport();
  const width = premiumCardWidth();
  const column = index % PREMIUM_CARD.columns;
  const row = Math.floor(index / PREMIUM_CARD.columns);
  return {
    x: view.left + width / 2 + column * (width + PREMIUM_CARD.gapX),
    y: view.top + PREMIUM_CARD.height / 2 + row * (PREMIUM_CARD.height + PREMIUM_CARD.gapY),
  };
}

/** 그 수만큼의 칸이 쌓인 높이. 창보다 길면 그 안에서 흐른다. */
export function premiumGridContentHeight(count: number): number {
  if (count <= 0) return 0;
  const rows = Math.ceil(count / PREMIUM_CARD.columns);
  return rows * (PREMIUM_CARD.height + PREMIUM_CARD.gapY) - PREMIUM_CARD.gapY;
}

/** 라벨 한 장의 중심. 넷이 화면 폭을 고르게 나눠 갖는다. */
export function premiumTabSpot(index: number, count: number): { x: number; y: number } {
  const { width, height, gap, bottom } = PREMIUM_TAB_ROW;
  const total = width * count + gap * (count - 1);
  const left = (BASE_WIDTH - total) / 2;
  return { x: left + width / 2 + index * (width + gap), y: bottom - height / 2 };
}

/** 화면 밑동까지의 여백 판정에 쓰는 전체 높이. */
export const PREMIUM_SCREEN_BOTTOM = BASE_HEIGHT;
