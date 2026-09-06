import { describe, expect, it } from "vitest";
import {
  ELEMENT_ADVANTAGE_MULTIPLIER,
  ELEMENT_COUNTERS,
  ELEMENT_DISADVANTAGE_MULTIPLIER,
  effectiveElement,
  elementMultiplier,
} from "../../src/core/element";
import { getRelic } from "../../src/data/relics";
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

/**
 * 얼음은 다섯 속성과 정규 토너먼트를 이루지 않는 예외 6번째 값이다. 패시브의
 * `elementOverride`로만 가로채이며, `Element`(아이콘·자동편성 표시)는 늘리지 않는다.
 */
describe("얼음 가로채기", () => {
  it("는 풀·물·땅에 유리하고 불에 불리하며 바람과는 무상성이다", () => {
    for (const defender of ["grass", "water", "earth"] as const) {
      expect(elementMultiplier("ice", defender)).toBe(ELEMENT_ADVANTAGE_MULTIPLIER);
    }
    expect(elementMultiplier("ice", "fire")).toBe(ELEMENT_DISADVANTAGE_MULTIPLIER);
    expect(elementMultiplier("ice", "wind")).toBe(1);
    expect(elementMultiplier("ice", "ice")).toBe(1);
  });

  it("는 방향을 뒤집으면 역수 배율이 된다(왕복 곱은 1)", () => {
    for (const attacker of ["grass", "water", "earth", "fire", "wind"] as const) {
      expect(elementMultiplier(attacker, "ice") * elementMultiplier("ice", attacker)).toBeCloseTo(1, 10);
    }
  });

  it("effectiveElement는 elementOverride가 없으면 원래 속성을 그대로 돌려준다", () => {
    const anky = getRelic("anky");
    expect(effectiveElement(anky)).toBe(anky.element);
  });

  it("effectiveElement는 elementOverride가 있으면 그 값으로 가로챈다", () => {
    const disguised = { ...getRelic("anky"), passive: { ...getRelic("anky").passive, elementOverride: "ice" as const } };
    expect(disguised.element).toBe("earth");
    expect(effectiveElement(disguised)).toBe("ice");
  });
});
