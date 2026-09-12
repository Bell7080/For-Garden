/**
 * 무역 패키지 전시장의 자리 계산.
 *
 * Phaser 없이 읽히는 순수 규칙만 둔다 — 카드가 팝업 몸판의 깎인 모서리를 넘지 않는지, 액자와
 * 값줄이 카드 안에 드는지를 화면을 띄우지 않고 테스트로 고정하기 위해서다. 예전 무역은 창
 * 높이를 손으로 1420이라 적고 줄을 190씩 내려놓아, 상품이 일곱 줄이 되자 마지막 줄이 **판 밖
 * 으로** 나갔다. 높이는 적는 것이 아니라 쌓인 카드에서 거꾸로 구한다.
 */

/** 창 폭과 카드 한 장의 규격. 값은 이 표에만 있다. */
const BASE = {
  width: 940,
  /** 좌우 안쪽 여백. 위쪽 여백과 합쳐 몸판의 깎인 왼쪽 위 모서리를 넘어야 카드가 빗변 안에 든다. */
  padX: 60,
  /** 제목표가 윗변에 걸터앉으므로 첫 카드는 그보다 아래에서 시작한다. */
  topPad: 104,
  bottomPad: 84,
  cardHeight: 300,
  cardGap: 28,
  /** 카드 안 왼쪽·오른쪽 안쪽 여백. 깎인 모서리를 피해 글과 액자가 앉는 선이다. */
  cardPadX: 36,
  /** 지급 액자 한 칸과 칸 사이. */
  frame: 118,
  frameGap: 18,
} as const;

export interface TradePackageCardMetrics {
  width: number;
  height: number;
  /** 카드 국소 좌표(가운데가 0)의 각 줄. */
  nameY: number;
  valueY: number;
  hairlineY: number;
  frameY: number;
  frameSize: number;
  costY: number;
  limitY: number;
  /** 글과 액자가 앉는 좌·우 선. */
  left: number;
  right: number;
  /** 지급 액자 `count`장이 설 중심 x. 한 장이든 셋이든 카드 가운데를 기준으로 모인다. */
  frameCenters: (count: number) => number[];
}

export interface TradePackageLayout {
  width: number;
  height: number;
  card: TradePackageCardMetrics;
  /** 카드 `count`장이 창 안에서 설 중심 y. */
  centers: number[];
}

/** 카드 한 장의 내부 자리. 카드 크기가 바뀌면 모든 줄이 함께 따라온다. */
export function tradePackageCardMetrics(width = BASE.width - BASE.padX * 2, height = BASE.cardHeight): TradePackageCardMetrics {
  const left = -width / 2 + BASE.cardPadX;
  const right = width / 2 - BASE.cardPadX;
  const top = -height / 2;
  const nameY = top + 42;
  return {
    width, height,
    nameY,
    valueY: nameY,
    hairlineY: top + 78,
    frameY: top + 78 + 24 + BASE.frame / 2,
    frameSize: BASE.frame,
    costY: height / 2 - 44,
    limitY: height / 2 - 40,
    left, right,
    // 액자는 왼쪽에 붙이지 않고 **가운데로 모은다** — 한 장만 주는 패키지에서 카드 오른쪽
    // 절반이 통째로 비어 무엇을 기다리는 자리처럼 보이기 때문이다.
    frameCenters: (count: number) => {
      const span = count * BASE.frame + Math.max(0, count - 1) * BASE.frameGap;
      return Array.from({ length: count }, (_, index) => -span / 2 + BASE.frame / 2 + index * (BASE.frame + BASE.frameGap));
    },
  };
}

/**
 * 카드 `cards`장을 담는 창 하나의 모든 자리.
 *
 * 높이를 쌓인 카드에서 구하므로 전시 품목이 둘이든 넷이든 마지막 카드가 판 밖으로 밀려나지
 * 않는다. 창을 열 때와 서버 응답을 그릴 때 **같은 함수**를 쓰되, 서버가 더 적게 돌려주면
 * `tradePackageCenters`가 남은 자리에서 가운데로 모은다.
 */
export function tradePackageLayout(cards: number): TradePackageLayout {
  const count = Math.max(1, cards);
  const height = BASE.topPad + count * BASE.cardHeight + (count - 1) * BASE.cardGap + BASE.bottomPad;
  return {
    width: BASE.width,
    height,
    card: tradePackageCardMetrics(),
    centers: tradePackageCenters(count, height),
  };
}

/**
 * 카드 묶음을 창의 내용 영역 안에서 세로로 모은다.
 *
 * 창 높이는 전시할 수 있는 최대 품목 수로 한 번 정해지는데, 그날 운영이 두 장만 올렸다면 남은
 * 자리를 아래에 몰아 두면 판이 아래로 텅 빈다. 실제로 쌓인 높이를 재고 그 덩어리를 가운데에 놓는다.
 */
export function tradePackageCenters(cards: number, height: number): number[] {
  if (cards <= 0) return [];
  const top = -height / 2 + BASE.topPad;
  const bottom = height / 2 - BASE.bottomPad;
  const stack = cards * BASE.cardHeight + (cards - 1) * BASE.cardGap;
  const start = top + Math.max(0, (bottom - top - stack) / 2);
  return Array.from({ length: cards }, (_, index) => start + BASE.cardHeight / 2 + index * (BASE.cardHeight + BASE.cardGap));
}
