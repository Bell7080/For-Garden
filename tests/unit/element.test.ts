import { describe, expect, it } from "vitest";
import {
  ELEMENT_ADVANTAGE_MULTIPLIER,
  ELEMENT_COUNTERS,
  ELEMENT_DISADVANTAGE_MULTIPLIER,
  elementEffectiveness,
  elementMultiplier,
} from "../../src/core/element";
import type { Element } from "../../src/core/types";

/** 오각형 상성표가 누락·상호 우위 없이 닫혀 있는지 전수 검사한다. */
describe("다섯 속성 상성", () => {
  const elements = Object.keys(ELEMENT_COUNTERS) as Element[];

  it("각 속성이 자기 자신을 제외한 정확히 두 속성을 카운터한다", () => {
    for (const element of elements) {
      expect(new Set(ELEMENT_COUNTERS[element]).size).toBe(2);
      expect(ELEMENT_COUNTERS[element]).not.toContain(element);
    }
  });

  it("서로 다른 모든 쌍에는 한쪽 우위만 존재한다", () => {
    for (const attacker of elements) {
      for (const defender of elements) {
        if (attacker === defender) continue;
        const forward = ELEMENT_COUNTERS[attacker].includes(defender);
        const backward = ELEMENT_COUNTERS[defender].includes(attacker);
        expect(Number(forward) + Number(backward)).toBe(1);
      }
    }
  });

  it("유리 1.25배·불리 0.8배·동속성 1배 공식을 적용한다", () => {
    expect(elementMultiplier("fire", "grass")).toBe(ELEMENT_ADVANTAGE_MULTIPLIER);
    expect(elementMultiplier("grass", "fire")).toBe(ELEMENT_DISADVANTAGE_MULTIPLIER);
    expect(elementMultiplier("fire", "fire")).toBe(1);
    expect(ELEMENT_ADVANTAGE_MULTIPLIER * ELEMENT_DISADVANTAGE_MULTIPLIER).toBe(1);
  });
});

describe("표시용 상성 방향", () => {
  it("같은 속성은 표식이 없고 이기는 쪽과 지는 쪽만 방향을 갖는다", () => {
    expect(elementEffectiveness("fire", "fire")).toBeUndefined();
    expect(elementEffectiveness("fire", "grass")).toBe("advantage");
    expect(elementEffectiveness("grass", "fire")).toBe("disadvantage");
  });
});
