import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
// 하단 탭의 윗변. `BottomNav`가 아니라 순수 표에서 읽어 이 자리표가 Phaser를 들여오지 않는다.
import { LOBBY_NAV_TOP } from "./lobbyLayout";
import type { PremiumCategory } from "../data/products";

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
 * 다섯(패키지·패스·특가·한정·다이아)이 나란히 서므로 칸이 상점(셋)보다 좁다. 하단 탭 바로 위에 서고,
 * 우하단에는 뒤로가기가 없는 화면이라(하단 탭이 그 몫을 한다) 왼쪽에 붙이지 않고 화면 폭을 고르게 나눈다.
 */
export const PREMIUM_TAB_ROW = { width: 214, height: 82, gap: 8, bottom: LOBBY_NAV_TOP - 22, edge: 24 } as const;

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
  /** 보너스가 없을 때 홀로 서는 액자. */
  frame: 160,
  frameY: -86,
  /**
   * 첫 구매 보너스가 남은 칸 — **기본 액자 + 「+」 + 보너스 액자**가 나란히 서고, 보너스 액자 위에 제목표가 걸린다.
   * 모서리 글자 한 줄로 알리던 때는 무엇이 더 들어오는지 셈해야 했다 — 액자가 하나 더 서면 두 배가 보인다.
   */
  bonus: { frame: 132, offsetX: 108, plusSize: 52, titleSize: 22, titleGap: 18 },
  nameY: 34,
  price: { y: 118, height: 74, inset: 64, size: 38 },
  /** 남은 구매 횟수·결제 불가 사유. 값줄 아래 칸 밑동에 한 줄로 선다. */
  remainingY: 176,
  /** 드래그와 탭을 가르는 거리. 이보다 많이 밀렸으면 스크롤이지 구매가 아니다. */
  dragSlop: 16,
} as const;

/**
 * 한 줄에 하나씩 눕는 **가로 패키지 카드** — 무역 전시장과 같은 겉모습(`paintShowcaseCard`)이다.
 *
 * 묶음은 받는 것이 여럿(액자 최대 네 장)이라 두 칸 격자에 넣으면 액자가 작아진다 — 폭 전체를 쓰고 위에서부터
 * 이름(왼쪽) → 받는 것(가운데) → 값(가운데 아래)으로 쌓는다. 액자와 값이 한 세로줄에 서야 "무엇을 얼마에"가
 * 한눈에 읽힌다. 액자 수량은 **가방과 같은 양식**(`addFrameAmount`)이다.
 * 윗변에 꼬리표가 걸터앉아 위로 한 뼘 나오므로, 첫 카드는 그만큼 내려 서고 카드 사이도 그만큼 벌린다.
 */
export const PREMIUM_WIDE = {
  height: 350,
  gapY: 50,
  /** 첫 카드의 꼬리표가 창 위로 잘리지 않게 내려 서는 몫. */
  topInset: 34,
  /** 카드 안쪽 여백. */
  pad: 44,
  /** 받는 것 액자 한 변과 간격. 최대 `frameCap`장이 가운데에 선다. */
  frame: 128,
  frameGap: 14,
  frameCap: 4,
  nameSize: 36,
  /** 값 칸과 양 끝 곁말 사이의 최소 간격. */
  priceGap: 28,
  /** 값 줄 양 끝의 곁말(남은 구매·정기권 기간). */
  noteSize: 22,
  /**
   * 묶음 카드의 쌓는 자리(카드 중심 기준). 이름은 왼쪽 위, 액자 줄은 가운데, 값은 그 아래 가운데에 서고
   * 남은 구매(오른쪽)·정기권 기간(왼쪽)은 값과 같은 줄 양 끝에 작게 붙는다.
   */
  stack: { nameY: -122, frameY: -16, price: { y: 112, width: 300, height: 76, size: 42 } },
} as const;

/** 묶음 카드의 액자 `count`장 중심 x — 가운데 정렬. */
export function premiumWideFrameXs(count: number): number[] {
  const { frame, frameGap } = PREMIUM_WIDE;
  const span = count * frame + Math.max(0, count - 1) * frameGap;
  return Array.from({ length: count }, (_, index) => -span / 2 + frame / 2 + index * (frame + frameGap));
}

/** 이 갈래의 카드가 서는 방식. 다이아만 두 칸, 나머지 묶음은 한 줄에 하나다. */
export type PremiumListKind = "wide" | "grid";
export function premiumListKind(category: PremiumCategory): PremiumListKind {
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
  if (kind !== "grid") return view.right - view.left;
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
  if (kind !== "grid") return { x: view.left + width / 2, y: view.top + PREMIUM_WIDE.topInset + height / 2 + index * (height + PREMIUM_WIDE.gapY) };
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
  if (kind !== "grid") return PREMIUM_WIDE.topInset + count * (height + PREMIUM_WIDE.gapY) - PREMIUM_WIDE.gapY;
  const rows = Math.ceil(count / PREMIUM_CARD.columns);
  return rows * (height + PREMIUM_CARD.gapY) - PREMIUM_CARD.gapY;
}

/**
 * 라벨 줄이 보이는 창. 여덟을 한 줄에 다 깔면 칸이 좁아지므로 라벨은 넓게 세우고 줄을 옆으로 흘린다 —
 * 패스 팝업의 탭 줄과 같은 문법이다. 창 밖으로 나간 이웃은 마스크가 자른다.
 */
export function premiumTabStrip(): { left: number; right: number; top: number; bottom: number } {
  const { height, bottom, edge } = PREMIUM_TAB_ROW;
  return { left: edge, right: BASE_WIDTH - edge, top: bottom - height - 8, bottom: bottom + 8 };
}

/** 줄 좌표(스크롤 0)에서 라벨 한 장의 중심. 첫 라벨이 창 왼쪽 끝에 붙는다. */
export function premiumTabSpot(index: number): { x: number; y: number } {
  const { width, height, gap, bottom } = PREMIUM_TAB_ROW;
  return { x: premiumTabStrip().left + width / 2 + index * (width + gap), y: bottom - height / 2 };
}

/** 줄이 왼쪽으로 밀릴 수 있는 끝(음수). 다 보이면 0이다. */
export function premiumTabMinScroll(count: number): number {
  const { width, gap } = PREMIUM_TAB_ROW;
  const strip = premiumTabStrip();
  const span = count * width + Math.max(0, count - 1) * gap;
  return Math.min(0, strip.right - strip.left - span);
}

/** `index`번째 라벨을 창 가운데로 모으는 스크롤. 끝에서는 줄의 한계에 멈춘다. */
export function premiumTabScrollFor(index: number, count: number): number {
  const strip = premiumTabStrip();
  const centered = (strip.left + strip.right) / 2 - premiumTabSpot(index).x;
  return Math.max(premiumTabMinScroll(count), Math.min(0, centered));
}

/** 쓸어 넘기기로 이동할 라벨. 처음·끝에서는 그대로다. direction 1 = 다음. */
export function premiumTabStep(index: number, count: number, direction: -1 | 1): number {
  return Math.max(0, Math.min(count - 1, index + direction));
}

/** 가로로 쓸어 넘겼다고 보는 거리와, 세로 스크롤과 갈리는 판정 거리. */
export const PREMIUM_SWIPE = { distance: 90, lock: 14 } as const;

/** 화면 밑동까지의 여백 판정에 쓰는 전체 높이. */
export const PREMIUM_SCREEN_BOTTOM = BASE_HEIGHT;
