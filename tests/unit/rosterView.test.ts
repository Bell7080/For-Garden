import { describe, expect, it } from "vitest";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { EMPTY_RELIC_FILTER } from "../../src/core/relicFilter";
import { applyRosterView, DEFAULT_ROSTER_VIEW, rosterFilterCount, withRosterSort } from "../../src/core/rosterView";

const power = (relic: { specimenNumber: string }): number => Number(relic.specimenNumber.replace(/\D/g, "")) || 0;

describe("편성 목록 보기", () => {
  it("기본은 도감처럼 개체번호 오름차순이고 아무것도 거르지 않는다", () => {
    const shown = applyRosterView(PLAYABLE_RELICS, DEFAULT_ROSTER_VIEW, power);
    expect(shown).toHaveLength(PLAYABLE_RELICS.length);
    const numbers = shown.map((relic) => relic.specimenNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a.localeCompare(b)));
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
});
