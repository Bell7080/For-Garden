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

const torika = RELICS.find((relic) => relic.id === "torika")!;

describe("도감 필터", () => {
  it("빈 조건은 모든 개체를 통과시킨다", () => {
    expect(isRelicFilterEmpty(EMPTY_RELIC_FILTER)).toBe(true);
    expect(relicFilterCount(EMPTY_RELIC_FILTER)).toBe(0);
    for (const relic of RELICS) expect(matchesRelicFilter(relic, EMPTY_RELIC_FILTER)).toBe(true);
  });

  it("한 축 안은 OR, 축 사이는 AND다", () => {
    const both = { ...EMPTY_RELIC_FILTER, elements: [torika.element], roles: [torika.role] };
    expect(matchesRelicFilter(torika, both)).toBe(true);
    // 같은 축에 다른 값을 더해도 통과한다(OR).
    const other = RELICS.find((relic) => relic.element !== torika.element)!;
    expect(matchesRelicFilter(torika, { ...both, elements: [torika.element, other.element] })).toBe(true);
    // 다른 축이 어긋나면 떨어진다(AND).
    const wrongRole = RELICS.find((relic) => relic.role !== torika.role)!.role;
    expect(matchesRelicFilter(torika, { ...both, roles: [wrongRole] })).toBe(false);
  });

  it("사거리도 같은 규칙을 쓴다", () => {
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, reaches: [torika.reachTier] })).toBe(true);
    const wrong = (["melee", "mid", "ranged"] as const).find((tier) => tier !== torika.reachTier)!;
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, reaches: [wrong] })).toBe(false);
  });

  it("검색은 공백과 대소문자를 지우고 이름·개체번호 둘 다 받는다", () => {
    expect(normalizeQuery(" PF 001 ")).toBe("pf001");
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, query: torika.name })).toBe(true);
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, query: torika.specimenNumber.toLowerCase() })).toBe(true);
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, query: "없는이름zzz" })).toBe(false);
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

describe("도감 필터 — 등급·소속", () => {
  it("등급과 소속도 조건 수에 들고 한 축 안은 OR, 축끼리는 AND다", () => {
    const filter = { ...EMPTY_RELIC_FILTER, rarities: [torika.rarity], squads: [torika.squad] };
    expect(relicFilterCount(filter)).toBe(2);
    expect(matchesRelicFilter(torika, filter)).toBe(true);
    const otherRarity = torika.rarity === "SSR" ? "R" : "SSR";
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, rarities: [otherRarity] })).toBe(false);
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, rarities: [otherRarity, torika.rarity] })).toBe(true);
    const otherSquad = RELICS.find((relic) => relic.squad !== torika.squad)!.squad;
    expect(matchesRelicFilter(torika, { ...EMPTY_RELIC_FILTER, squads: [otherSquad] })).toBe(false);
  });
});
