import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 가운데로 모인 층의 자리표.
 *
 * **좌우로 번갈아 뻗지 않는다.** 지그재그는 훑는 눈을 매 줄 좌우로 끌고 다녀 목록이 정신없이
 * 읽혔다. 층은 모두 같은 x에 선다.
 *
 * **화면 밖으로 넘치지도 않는다.** 예전에는 양 끝을 화면 밖으로 뻗어 "밖으로 이어지는 띠"로
 * 두었는데, 그러면 층 하나가 어디서 시작해 어디서 끝나는지가 화면 안에 없어 목록이 아니라
 * 잘린 배경처럼 읽혔다. 지금은 네 변이 모두 화면 안에 드는 **가운데 선 버튼**이라, 누를 수
 * 있는 것과 그 경계가 한눈에 잡힌다.
 */
export const INTERACTION_LAYER = {
  /** 첫 층의 중심 y. 상단 줄과 제목 아래다. */
  firstY: 452,
  /** 층 사이 간격(중심 기준). 두께보다 넉넉히 벌려 층끼리 붙어 보이지 않게 한다. */
  step: 214,
  /** 층 한 장의 두께. 안에 원화와 두 줄이 함께 들어갈 만큼 두껍다. */
  height: 176,
  /** 화면 양옆에 같은 여백을 남기고 가운데에 서는 버튼 폭. */
  width: BASE_WIDTH - 120,
  /** 글과 원화가 층 안에서 갖는 사방 여백. */
  padding: 34,
  /**
   * 글이 판 왼쪽 변에서 얼마나 더 안으로 들어와 시작하는지.
   *
   * 층이 화면 안에 통째로 들어오므로 왼쪽 여백도 화면 안에 있다. 변에서 더 밀어 넣을 이유는
   * 이제 하나뿐이라 — 원화가 왼쪽 끝에서 판 색으로 녹는 폭 안쪽에서 글이 시작해야 대비가
   * 배경 원화와 무관해진다 — 값이 여백 한 칸 남짓으로 줄었다.
   */
  textInset: 26,
  /** 목록이 흐르는 창. 우하단 뒤로가기 자리를 침범하지 않는 높이에서 끊는다. */
  viewport: { top: 300, bottom: BASE_HEIGHT - 260 },
} as const;

/**
 * 층 하나의 중심 좌표.
 *
 * 모든 층이 화면 가운데에 선다 — 층마다 자리가 달라지면 목록이 아니라 흩어진 카드로 읽힌다.
 */
export function interactionLayerSpot(index: number): { x: number; y: number } {
  return { x: BASE_WIDTH / 2, y: INTERACTION_LAYER.firstY + index * INTERACTION_LAYER.step };
}

/** 층 목록 전체가 차지하는 높이. 창보다 길면 그 안에서 흐른다. */
export function interactionLayersHeight(count: number): number {
  if (count <= 0) return 0;
  return (count - 1) * INTERACTION_LAYER.step + INTERACTION_LAYER.height;
}
