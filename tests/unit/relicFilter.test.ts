import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import {
  EMPTY_RELIC_FILTER,
  isRelicFilterEmpty,
  matchesRelicFilter,
  normalizeQuery,
  relicFilterCount,
  toggleFilterValue,
} from "../../src/core/relicFilter";

const anky = RELICS.find((relic) => relic.id === "anky")!;

describe("도감 필터", () => {
  it("빈 조건은 모든 개체를 통과시킨다", () => {
    expect(isRelicFilterEmpty(EMPTY_RELIC_FILTER)).toBe(true);
    expect(relicFilterCount(EMPTY_RELIC_FILTER)).toBe(0);
    for (const relic of RELICS) expect(matchesRelicFilter(relic, EMPTY_RELIC_FILTER)).toBe(true);
  });

  it("한 축 안은 OR, 축 사이는 AND다", () => {
    const both = { ...EMPTY_RELIC_FILTER, elements: [anky.element], roles: [anky.role] };
    expect(matchesRelicFilter(anky, both)).toBe(true);
    // 같은 축에 다른 값을 더해도 통과한다(OR).
    const other = RELICS.find((relic) => relic.element !== anky.element)!;
    expect(matchesRelicFilter(anky, { ...both, elements: [anky.element, other.element] })).toBe(true);
    // 다른 축이 어긋나면 떨어진다(AND).
    const wrongRole = RELICS.find((relic) => relic.role !== anky.role)!.role;
    expect(matchesRelicFilter(anky, { ...both, roles: [wrongRole] })).toBe(false);
  });

  it("사거리도 같은 규칙을 쓴다", () => {
    expect(matchesRelicFilter(anky, { ...EMPTY_RELIC_FILTER, reaches: [anky.reachTier] })).toBe(true);
    const wrong = (["melee", "mid", "ranged"] as const).find((tier) => tier !== anky.reachTier)!;
    expect(matchesRelicFilter(anky, { ...EMPTY_RELIC_FILTER, reaches: [wrong] })).toBe(false);
  });

  it("검색은 공백과 대소문자를 지우고 이름·개체번호 둘 다 받는다", () => {
    expect(normalizeQuery(" PF 001 ")).toBe("pf001");
    expect(matchesRelicFilter(anky, { ...EMPTY_RELIC_FILTER, query: anky.name })).toBe(true);
    expect(matchesRelicFilter(anky, { ...EMPTY_RELIC_FILTER, query: anky.specimenNumber.toLowerCase() })).toBe(true);
    expect(matchesRelicFilter(anky, { ...EMPTY_RELIC_FILTER, query: "없는이름zzz" })).toBe(false);
  });

  it("검색 글만 있어도 비어 있지 않지만 조건 수에는 세지 않는다", () => {
    const searching = { ...EMPTY_RELIC_FILTER, query: "토" };
    expect(isRelicFilterEmpty(searching)).toBe(false);
    expect(relicFilterCount(searching)).toBe(0);
  });

  it("같은 값을 다시 누르면 빠진다", () => {
    expect(toggleFilterValue(["fire"], "water")).toEqual(["fire", "water"]);
    expect(toggleFilterValue(["fire", "water"], "fire")).toEqual(["water"]);
  });
});
