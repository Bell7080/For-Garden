import { describe, expect, it } from "vitest";
import { ELEMENT_COUNTERS } from "../../src/core/element";
import type { Element } from "../../src/core/types";
import {
  ELEMENT_RING,
  elementChartEdges,
  elementChartNodes,
  elementStrongAgainst,
  elementWeakTo,
} from "../../src/ui/elementChart";

describe("속성 상성 오각형", () => {
  it("다섯 속성이 빠짐없이 한 번씩 선다", () => {
    expect([...ELEMENT_RING].sort()).toEqual((Object.keys(ELEMENT_COUNTERS) as Element[]).sort());
  });

  it("그린 화살표가 실제 상성표와 정확히 같다", () => {
    const drawn = elementChartEdges().map(({ from, to }) => `${from}>${to}`).sort();
    const truth = (Object.keys(ELEMENT_COUNTERS) as Element[])
      .flatMap((from) => ELEMENT_COUNTERS[from].map((to) => `${from}>${to}`))
      .sort();
    expect(drawn).toEqual(truth);
    expect(drawn).toHaveLength(10);
  });

  it("바깥 고리는 이웃을 이기는 다섯이다", () => {
    const outer = elementChartEdges().filter((edge) => edge.outer);
    expect(outer).toHaveLength(5);
    for (const edge of outer) expect(ELEMENT_COUNTERS[edge.from]).toContain(edge.to);
  });

  it("꼭짓점은 12시에서 시작해 고르게 퍼진다", () => {
    const nodes = elementChartNodes(100);
    expect(nodes[0].x).toBeCloseTo(0, 6);
    expect(nodes[0].y).toBeCloseTo(-100, 6);
    for (const node of nodes) expect(Math.hypot(node.x, node.y)).toBeCloseTo(100, 6);
  });

  it("유리·불리는 각각 둘이고 서로 겹치지 않는다", () => {
    for (const element of ELEMENT_RING) {
      const strong = elementStrongAgainst(element);
      const weak = elementWeakTo(element);
      expect(strong).toHaveLength(2);
      expect(weak).toHaveLength(2);
      for (const other of weak) expect(strong).not.toContain(other);
    }
  });
});
