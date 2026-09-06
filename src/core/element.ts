import type { Element, RelicDef } from "./types";

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

/**
 * 상성 계산에서만 쓰는 가상의 6번째 속성이다.
 *
 * `Element`(실제 데이터·아이콘·자동편성 표시가 쓰는 다섯 속성)에는 넣지 않는다 — 아이콘·색을
 * 새로 굽지 않고, 매디처럼 **패시브가 상성만 가로채는 개체 하나만을 위해** 존재한다. 다섯
 * 속성끼리의 정규 토너먼트(위 `ELEMENT_COUNTERS`)는 그대로 두고, 얼음은 그 다섯과의 관계만
 * 별도로 정의한다 — 풀·물·땅에 유리, 불에 불리, 바람과는 무상성인 비대칭 관계라 "정확히 2승
 * 2패" 규칙에 끼워 넣을 수 없기 때문이다.
 */
export type EffectiveElement = Element | "ice";

const ICE_ADVANTAGES: readonly Element[] = ["grass", "water", "earth"];
const ICE_DISADVANTAGES: readonly Element[] = ["fire"];

/** 같은 속성은 중립, 다른 속성은 반드시 유리 또는 불리 배율을 반환한다(얼음과 바람은 무상성으로 중립). */
export function elementMultiplier(attacker: EffectiveElement, defender: EffectiveElement): number {
  if (attacker === defender) return 1;
  if (attacker === "ice") {
    if (ICE_ADVANTAGES.includes(defender as Element)) return ELEMENT_ADVANTAGE_MULTIPLIER;
    if (ICE_DISADVANTAGES.includes(defender as Element)) return ELEMENT_DISADVANTAGE_MULTIPLIER;
    return 1;
  }
  if (defender === "ice") {
    if (ICE_ADVANTAGES.includes(attacker as Element)) return ELEMENT_DISADVANTAGE_MULTIPLIER;
    if (ICE_DISADVANTAGES.includes(attacker as Element)) return ELEMENT_ADVANTAGE_MULTIPLIER;
    return 1;
  }
  return ELEMENT_COUNTERS[attacker].includes(defender)
    ? ELEMENT_ADVANTAGE_MULTIPLIER
    : ELEMENT_DISADVANTAGE_MULTIPLIER;
}

/**
 * 실제 상성 계산에 쓸 속성이다.
 *
 * 평소엔 `RelicDef.element`를 그대로 돌려주지만, 패시브가 `elementOverride`를 선언한 개체는
 * 그 값으로 가로챈다 — 아이콘·색·`elementDistribution`(도감·배지 표시)은 여전히 원래 속성을
 * 읽으므로, 화면에는 물속성으로 보이면서 상성 계산과 자동편성 점수만 얼음으로 도는 매디 같은
 * 개체를 캐릭터 ID 분기 없이 데이터로 표현할 수 있다.
 */
export function effectiveElement(relic: RelicDef): EffectiveElement {
  return relic.passive.elementOverride ?? relic.element;
}
