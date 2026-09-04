import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 좌우에서 뻗어 나오는 층의 자리표.
 *
 * 층은 **화면 밖에서 시작해 안으로 들어온다** — 양 끝이 화면 안에서 끝나면 목록이 아니라
 * 카드 여러 장으로 읽힌다. 홀짝으로 뻗는 쪽을 바꿔 위에서 아래로 훑는 눈이 지그재그로 걸린다.
 */
export const INTERACTION_LAYER = {
  /** 첫 층의 중심 y. 상단 줄과 제목 아래다. */
  firstY: 430,
  /** 층 사이 간격(중심 기준). */
  step: 168,
  height: 132,
  /** 화면 폭보다 길게 뻗어 양 끝이 밖으로 나간다. */
  width: BASE_WIDTH + 220,
  /** 뻗어 나오는 쪽에서 화면 안으로 들어오는 깊이. 반대쪽 끝은 화면 밖에 남는다. */
  inset: 96,
  /** 목록이 흐르는 창. 우하단 뒤로가기 자리를 침범하지 않는 높이에서 끊는다. */
  viewport: { top: 300, bottom: BASE_HEIGHT - 260 },
} as const;

/**
 * 층 하나의 중심 좌표.
 *
 * 홀수 번째는 왼쪽에서, 짝수 번째는 오른쪽에서 뻗는다. 뻗어 나온 쪽 끝은 늘 화면 밖에 남고
 * 반대쪽 끝만 화면 안 `inset`까지 들어온다 — 양 끝이 모두 안에서 끝나면 층이 아니라 카드다.
 */
export function interactionLayerSpot(index: number): { x: number; y: number; fromLeft: boolean } {
  const fromLeft = index % 2 === 0;
  const half = INTERACTION_LAYER.width / 2;
  const x = fromLeft ? BASE_WIDTH - INTERACTION_LAYER.inset - half : INTERACTION_LAYER.inset + half;
  return { x, y: INTERACTION_LAYER.firstY + index * INTERACTION_LAYER.step, fromLeft };
}

/** 층 목록 전체가 차지하는 높이. 창보다 길면 그 안에서 흐른다. */
export function interactionLayersHeight(count: number): number {
  if (count <= 0) return 0;
  return (count - 1) * INTERACTION_LAYER.step + INTERACTION_LAYER.height;
}
