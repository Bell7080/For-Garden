import type { Element } from "./types";

/** 유리한 피해는 25% 증가하고 불리한 피해는 그 역수로 줄여 상성의 왕복 값을 보존한다. */
export const ELEMENT_ADVANTAGE_MULTIPLIER = 1.25;
export const ELEMENT_DISADVANTAGE_MULTIPLIER = 1 / ELEMENT_ADVANTAGE_MULTIPLIER;

/**
 * 각 속성이 이기는 두 속성이다.
 * 모든 서로 다른 속성 쌍에 승자가 정확히 하나인 정규 토너먼트라 사각지대나 상호 우위가 없다.
 */
export const ELEMENT_COUNTERS: Readonly<Record<Element, readonly [Element, Element]>> = {
  fire: ["grass", "wind"],
  water: ["fire", "earth"],
  grass: ["water", "earth"],
  earth: ["wind", "fire"],
  wind: ["grass", "water"],
};

/** 같은 속성은 중립, 다른 속성은 반드시 유리 또는 불리 배율을 반환한다. */
export function elementMultiplier(attacker: Element, defender: Element): number {
  if (attacker === defender) return 1;
  return ELEMENT_COUNTERS[attacker].includes(defender)
    ? ELEMENT_ADVANTAGE_MULTIPLIER
    : ELEMENT_DISADVANTAGE_MULTIPLIER;
}

/** 상성 결과를 표시용 방향 하나로 줄인다. 중립은 표식이 없으므로 undefined를 준다. */
export function elementEffectiveness(attacker: Element, defender: Element): "advantage" | "disadvantage" | undefined {
  const multiplier = elementMultiplier(attacker, defender);
  return multiplier > 1 ? "advantage" : multiplier < 1 ? "disadvantage" : undefined;
}
