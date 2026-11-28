import { describe, expect, it } from "vitest";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { EMPTY_RELIC_FILTER } from "../../src/core/relicFilter";
import { applyRosterView, DEFAULT_ROSTER_VIEW, deployedFirst, rosterFilterCount, withRosterSort } from "../../src/core/rosterView";

const power = (relic: { specimenNumber: string }): number => Number(relic.specimenNumber.replace(/\D/g, "")) || 0;

describe("편성 목록 보기", () => {
  it("기본은 강한 순(전투력 내림차순)이고 아무것도 거르지 않는다", () => {
    const shown = applyRosterView(PLAYABLE_RELICS, DEFAULT_ROSTER_VIEW, power);
    expect(shown).toHaveLength(PLAYABLE_RELICS.length);
    const powers = shown.map((relic) => power(relic));
    expect(powers).toEqual([...powers].sort((a, b) => b - a));
  });

  it("도감과 같은 필터 규칙으로 좁힌다", () => {
    const view = { ...DEFAULT_ROSTER_VIEW, filter: { ...EMPTY_RELIC_FILTER, rarities: ["SSR" as const] } };
    const shown = applyRosterView(PLAYABLE_RELICS, view, power);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((relic) => relic.rarity === "SSR")).toBe(true);
    expect(rosterFilterCount(view)).toBe(1);
  });

  it("기준을 바꾸면 그 기준의 첫 방향으로 돌아간다", () => {
    expect(withRosterSort({ ...DEFAULT_ROSTER_VIEW, descending: true }, "number").descending).toBe(false);
    expect(withRosterSort(DEFAULT_ROSTER_VIEW, "power").descending).toBe(true);
  });

  it("자리에 선 렐릭은 자리 순서대로 맨 앞에 서고 나머지는 정렬을 지킨다", () => {
    const list = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    expect(deployedFirst(list, ["d", null, "b"]).map((r) => r.id)).toEqual(["d", "b", "a", "c", "e"]);
    // 빈 칸·목록에 없는(필터에 걸러진) 렐릭은 끼우지 않는다.
    expect(deployedFirst(list, [null, "z", "e"]).map((r) => r.id)).toEqual(["e", "a", "b", "c", "d"]);
    expect(deployedFirst(list, [null, null, null]).map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
