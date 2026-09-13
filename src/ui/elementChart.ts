import type { Element } from "../core/types";
import { ELEMENT_COUNTERS } from "../core/element";

/**
 * 상성표를 오각형으로 세우는 순수 규칙.
 *
 * **다섯을 아무 순서로나 늘어놓지 않는다.** 「불 → 바람 → 풀 → 물 → 땅 → 불」은 각 속성이
 * **바로 다음**을 이기는 고리라, 바깥 테두리를 따라 도는 화살표 다섯 개가 그대로 관계 다섯
 * 개가 된다. 남은 다섯(한 칸 건너뛴 상대)은 안쪽에 별 모양으로 그어져 열 관계가 빠짐없이,
 * 그리고 겹치지 않고 한 장에 선다.
 *
 * 순서를 바꾸면 그 그림이 거짓말이 되므로 `tests/unit/elementChart.test.ts`가 두 고리가
 * 실제 상성표(`ELEMENT_COUNTERS`)와 정확히 같은 열 쌍인지 지킨다.
 */
export const ELEMENT_RING: readonly Element[] = ["fire", "wind", "grass", "water", "earth"];

export interface ChartNode {
  readonly element: Element;
  readonly x: number;
  readonly y: number;
}

/** 화살표 하나 — `from`이 `to`를 이긴다. */
export interface ChartEdge {
  readonly from: Element;
  readonly to: Element;
  /** 바깥 고리인가. 안쪽 별은 더 옅게 긋는다. */
  readonly outer: boolean;
}

/** 꼭짓점 자리. 12시에서 시계 방향으로 고르게 나눈다. */
export function elementChartNodes(radius: number): ChartNode[] {
  return ELEMENT_RING.map((element, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / ELEMENT_RING.length;
    return { element, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

/** 열 개의 화살표. 바깥 고리 다섯이 먼저, 안쪽 별 다섯이 뒤다. */
export function elementChartEdges(): ChartEdge[] {
  const size = ELEMENT_RING.length;
  const edges: ChartEdge[] = [];
  for (const step of [1, 2]) {
    for (let index = 0; index < size; index += 1) {
      edges.push({ from: ELEMENT_RING[index], to: ELEMENT_RING[(index + step) % size], outer: step === 1 });
    }
  }
  return edges;
}

/** 그 속성이 이기는 둘. 표가 아니라 계산에서 나오므로 화면이 다시 적지 않는다. */
export function elementStrongAgainst(element: Element): readonly Element[] {
  return ELEMENT_COUNTERS[element];
}

/** 그 속성을 이기는 둘. */
export function elementWeakTo(element: Element): Element[] {
  return ELEMENT_RING.filter((other) => other !== element && ELEMENT_COUNTERS[other].includes(element));
}
