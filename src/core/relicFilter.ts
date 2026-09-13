import type { Element, ReachTier, RelicDef, Role } from "./types";

/**
 * 도감이 목록을 좁히는 조건.
 *
 * 세 축은 **서로 AND**이고 한 축 안의 값들은 **OR**이다 — "불 또는 물 속성인 탱커"가 자연스러운
 * 물음이지, "불이면서 물"은 고를 수 있는 개체가 없다. 비어 있는 축은 조건이 없는 것으로 본다.
 *
 * 화면이 아니라 순수 모듈이 갖는 이유는, 걸린 조건 수를 버튼이 세고 목록을 그리드가 세는데
 * 둘이 다른 규칙을 쓰면 "2"라 적힌 버튼이 아무것도 걸러 내지 않는 일이 생기기 때문이다.
 */
export interface RelicFilter {
  readonly elements: readonly Element[];
  readonly roles: readonly Role[];
  readonly reaches: readonly ReachTier[];
  /** 이름·개체번호로 좁히는 글. 빈 글은 조건이 아니다. */
  readonly query: string;
}

export const EMPTY_RELIC_FILTER: RelicFilter = { elements: [], roles: [], reaches: [], query: "" };

/** 걸린 조건이 몇 개인가. 필터 버튼이 이 수를 달고 선다. */
export function relicFilterCount(filter: RelicFilter): number {
  return filter.elements.length + filter.roles.length + filter.reaches.length;
}

/** 검색까지 포함해 아무것도 걸리지 않았는가. */
export function isRelicFilterEmpty(filter: RelicFilter): boolean {
  return relicFilterCount(filter) === 0 && normalizeQuery(filter.query) === "";
}

/**
 * 찾는 글을 견주기 좋게 다듬는다.
 *
 * 대소문자와 **공백을 지운다** — 개체번호를 `PF 001`처럼 띄어 적어 두었어도 `pf001`로 찾을 수
 * 있어야 하고, 반대로 띄어 쓴 이름을 붙여 쳐도 걸려야 한다.
 */
export function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, "").toLowerCase();
}

/** 한 개체가 조건을 모두 통과하는가. */
export function matchesRelicFilter(relic: RelicDef, filter: RelicFilter): boolean {
  if (filter.elements.length > 0 && !filter.elements.includes(relic.element)) return false;
  if (filter.roles.length > 0 && !filter.roles.includes(relic.role)) return false;
  if (filter.reaches.length > 0 && !filter.reaches.includes(relic.reachTier)) return false;
  const query = normalizeQuery(filter.query);
  if (query === "") return true;
  // 이름과 개체번호 둘 다 받는다. 번호를 외운 손과 이름을 아는 손이 같은 칸을 쓴다.
  return normalizeQuery(relic.name).includes(query) || normalizeQuery(relic.specimenNumber).includes(query);
}

/** 한 축의 값을 켜고 끈다. 같은 값을 다시 누르면 빠진다. */
export function toggleFilterValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
