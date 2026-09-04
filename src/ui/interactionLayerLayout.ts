import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 가운데로 모인 층의 자리표.
 *
 * **좌우로 번갈아 뻗지 않는다.** 지그재그는 훑는 눈을 매 줄 좌우로 끌고 다녀 목록이 정신없이
 * 읽혔다. 층은 모두 같은 x에 서고 화면 양옆으로 조금씩 넘쳐, 끝이 밖으로 이어지는 띠로 남는다.
 */
export const INTERACTION_LAYER = {
  /** 첫 층의 중심 y. 상단 줄과 제목 아래다. */
  firstY: 452,
  /** 층 사이 간격(중심 기준). 두께보다 넉넉히 벌려 층끼리 붙어 보이지 않게 한다. */
  step: 214,
  /** 층 한 장의 두께. 안에 원화와 두 줄이 함께 들어갈 만큼 두껍다. */
  height: 176,
  /** 화면 폭보다 조금 길게 뻗어 양 끝이 밖으로 나간다. */
  width: BASE_WIDTH + 96,
  /** 글과 원화가 층 안에서 갖는 사방 여백. */
  padding: 30,
  /** 왼쪽 안에 슬쩍 눕는 원화의 폭. 층 두께에 맞춰 세로를 채운다. */
  artWidth: 300,
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
