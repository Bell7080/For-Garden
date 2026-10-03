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

/**
 * 한 줄에 하나씩 눕는 **가로 패키지 카드**.
 *
 * 묶음은 받는 것이 여럿(액자 최대 네 장)이라 두 칸 격자에 넣으면 액자가 작아져 수량이 읽히지 않는다 —
 * 폭 전체를 쓰고 왼쪽에 이름·받는 것, 오른쪽에 **크고 두꺼운 값**을 세운다. 다이아(`gem`)만 같은 모양이 넷
 * 반복되는 상품이라 예전 두 칸 격자를 쓴다(`premiumListKind`).
 */
export const PREMIUM_WIDE = {
  height: 330,
  gapY: 24,
  /** 카드 안쪽 여백. */
  pad: 34,
  /** 받는 것 액자 한 변과 간격. 최대 `frameCap`장이 왼쪽 열에 선다. */
  frame: 124,
  frameGap: 16,
  frameCap: 4,
  /** 액자 우하단 수량 글자 비율 — 공용 액자(0.23)보다 크게 키워 받는 양이 가장 먼저 읽히게 한다. */
  amountRatio: 0.36,
  nameSize: 40,
  nameY: -112,
  frameY: 12,
  /** 값 칸(오른쪽). 값 글자는 `display` 역할로 크고 두껍게 선다. */
  price: { width: 330, height: 124, size: 58, y: -18 },
  /** 값 칸과 왼쪽 열 사이의 최소 간격. */
  priceGap: 28,
  /** 값 칸 아래 한 줄(남은 구매·사유)과 왼쪽 아래 한 줄(패스 기간). */
  noteY: 96,
  footY: 134,
  noteSize: 22,
} as const;

/** 다이아 카드의 값 칸. 두 칸 격자의 카드 안에서 크고 두껍게 선다. */
export const PREMIUM_GRID_PRICE = { height: 92, size: 48 } as const;

/** 이 갈래의 카드가 서는 방식. 다이아만 두 칸, 나머지 묶음은 한 줄에 하나다. */
export type PremiumListKind = "wide" | "grid";
export function premiumListKind(category: "package" | "deal" | "limited" | "gem"): PremiumListKind {
  return category === "gem" ? "grid" : "wide";
}

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

/** 칸 하나의 폭. 두 칸과 그 사이 간격이 창을 정확히 나눠 갖고, 가로 카드는 창 폭 전체를 쓴다. */
export function premiumCardWidth(kind: PremiumListKind = "grid"): number {
  const view = premiumGridViewport();
  if (kind === "wide") return view.right - view.left;
  return (view.right - view.left - PREMIUM_CARD.gapX * (PREMIUM_CARD.columns - 1)) / PREMIUM_CARD.columns;
}

/** 카드 한 장의 높이. */
export function premiumCardHeight(kind: PremiumListKind = "grid"): number {
  return kind === "wide" ? PREMIUM_WIDE.height : PREMIUM_CARD.height;
}

/** 스크롤 0일 때 그 칸의 중심. 화면은 여기에 컨테이너 이동만 더한다. */
export function premiumCardSpot(index: number, kind: PremiumListKind = "grid"): { x: number; y: number } {
  const view = premiumGridViewport();
  const width = premiumCardWidth(kind);
  const height = premiumCardHeight(kind);
  if (kind === "wide") return { x: view.left + width / 2, y: view.top + height / 2 + index * (height + PREMIUM_WIDE.gapY) };
  const column = index % PREMIUM_CARD.columns;
  const row = Math.floor(index / PREMIUM_CARD.columns);
  return {
    x: view.left + width / 2 + column * (width + PREMIUM_CARD.gapX),
    y: view.top + height / 2 + row * (height + PREMIUM_CARD.gapY),
  };
}

/** 그 수만큼의 칸이 쌓인 높이. 창보다 길면 그 안에서 흐른다. */
export function premiumGridContentHeight(count: number, kind: PremiumListKind = "grid"): number {
  if (count <= 0) return 0;
  const height = premiumCardHeight(kind);
  if (kind === "wide") return count * (height + PREMIUM_WIDE.gapY) - PREMIUM_WIDE.gapY;
  const rows = Math.ceil(count / PREMIUM_CARD.columns);
  return rows * (height + PREMIUM_CARD.gapY) - PREMIUM_CARD.gapY;
}

/**
 * 가로 카드 안의 자리(카드 중심 기준). 받는 것 줄은 왼쪽 열, 값 칸은 오른쪽 열이고 둘은 서로를 넘지 않는다.
 * `frames`는 액자 `count`장의 중심 x이다.
 */
export function premiumWideInner(width: number, count: number): {
  left: number; frames: number[]; priceX: number; priceLeft: number; frameRight: number;
} {
  const { pad, frame, frameGap, price } = PREMIUM_WIDE;
  const left = -width / 2 + pad;
  const frames = Array.from({ length: count }, (_, index) => left + frame / 2 + index * (frame + frameGap));
  const priceX = width / 2 - pad - price.width / 2;
  return { left, frames, priceX, priceLeft: priceX - price.width / 2, frameRight: count > 0 ? frames[count - 1] + frame / 2 : left };
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
