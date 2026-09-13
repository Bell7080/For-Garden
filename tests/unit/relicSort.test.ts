import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { combatPower } from "../../src/core/combatPower";
import {
  RELIC_SORT_MODES, SORT_DEFAULT_DESCENDING, sortRelicsBy, type RelicSortMode,
} from "../../src/core/relicSort";

const powerOf = (relic: (typeof RELICS)[number]) => combatPower(relic.stats);
const numbers = (list: readonly (typeof RELICS)[number][]) => list.map(({ specimenNumber }) => specimenNumber);

describe("도감 정렬", () => {
  it("기준마다 처음 보여 주는 방향이 다르다", () => {
    // 번호는 세는 수라 001부터 서고, 귀한 것과 센 것은 위에 모여야 훑을 이유가 생긴다.
    expect(SORT_DEFAULT_DESCENDING.number).toBe(false);
    expect(SORT_DEFAULT_DESCENDING.rarity).toBe(true);
    expect(SORT_DEFAULT_DESCENDING.power).toBe(true);
  });

  it("방향을 뒤집으면 정확히 반대로 선다", () => {
    for (const mode of RELIC_SORT_MODES) {
      const up = sortRelicsBy(RELICS, mode, false, powerOf);
      const down = sortRelicsBy(RELICS, mode, true, powerOf);
      expect(up).toHaveLength(RELICS.length);
      expect(down).toHaveLength(RELICS.length);
      // 같은 개체가 빠지거나 늘지 않는다.
      expect(numbers(up).slice().sort()).toEqual(numbers(down).slice().sort());
    }
  });

  it("뒤집었다 되돌리면 원래 줄로 돌아온다", () => {
    // 동점까지 함께 뒤집으면 전투력이 같은 두 개체가 방향을 바꿀 때마다 자리를 맞바꾼다.
    for (const mode of RELIC_SORT_MODES) {
      const first = numbers(sortRelicsBy(RELICS, mode, false, powerOf));
      sortRelicsBy(RELICS, mode, true, powerOf);
      expect(numbers(sortRelicsBy(RELICS, mode, false, powerOf))).toEqual(first);
    }
  });

  it("동점은 어느 방향에서나 개체번호 오름차순으로 끊는다", () => {
    // 전투력을 통째로 같게 만들면 남는 것은 동점 규칙뿐이다.
    const flat = () => 0;
    const up = numbers(sortRelicsBy(RELICS, "power", false, flat));
    const down = numbers(sortRelicsBy(RELICS, "power", true, flat));
    expect(up).toEqual(down);
    expect(up).toEqual([...up].sort());
  });

  it("희귀도는 내림차순에서 SSR이 먼저 선다", () => {
    const down = sortRelicsBy(RELICS, "rarity", true, powerOf);
    const up = sortRelicsBy(RELICS, "rarity", false, powerOf);
    expect(down[0].rarity).toBe("SSR");
    expect(up[0].rarity).toBe("R");
  });

  it("전투력은 내림차순에서 큰 값이 먼저 선다", () => {
    const down = sortRelicsBy(RELICS, "power", true, powerOf);
    for (let i = 1; i < down.length; i += 1) expect(powerOf(down[i - 1])).toBeGreaterThanOrEqual(powerOf(down[i]));
    const up = sortRelicsBy(RELICS, "power", false, powerOf);
    for (let i = 1; i < up.length; i += 1) expect(powerOf(up[i - 1])).toBeLessThanOrEqual(powerOf(up[i]));
  });

  it("개체번호는 오름차순에서 001부터 선다", () => {
    const up = numbers(sortRelicsBy(RELICS, "number", false, powerOf));
    expect(up).toEqual([...up].sort());
    const modes: RelicSortMode[] = [...RELIC_SORT_MODES];
    expect(modes).toEqual(["number", "rarity", "power"]);
  });
});
