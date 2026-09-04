import { describe, expect, it } from "vitest";
import { autoAssignExcavation, EXCAVATION_AUTO_MODES, EXCAVATION_AUTO_MODE_LABEL, type ExcavationCandidate } from "../../src/core/excavationAutoAssign";
import { RELICS } from "../../src/data/relics";

const candidates: ExcavationCandidate[] = RELICS.map((def) => ({ def, progress: { level: 1, breakthrough: 0 } }));
const currencyOf = (id: string | null): string | undefined => RELICS.find((relic) => relic.id === id)?.excavationTrait.primaryCurrency;

describe("발굴 자동 배치", () => {
  it("세 자리를 채우고 같은 렐릭을 두 번 세우지 않는다", () => {
    for (const mode of EXCAVATION_AUTO_MODES) {
      const assigned = autoAssignExcavation(candidates, mode);
      expect(assigned).toHaveLength(3);
      const ids = assigned.filter((id): id is string => id !== null);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("치우친 기준은 그 재화를 캐는 렐릭을 먼저 세운다", () => {
    const fossil = autoAssignExcavation(candidates, "fossil");
    // 화석을 캐는 렐릭이 하나라도 있으면 첫 자리는 반드시 그 재화다.
    const anyFossil = RELICS.some((relic) => relic.excavationTrait.primaryCurrency === "fossil");
    if (anyFossil) expect(currencyOf(fossil[0])).toBe("fossil");
  });

  it("골고루는 서로 다른 재화를 세운다", () => {
    const assigned = autoAssignExcavation(candidates, "balanced");
    const currencies = assigned.filter((id): id is string => id !== null).map(currencyOf);
    expect(new Set(currencies).size).toBe(currencies.length);
  });

  it("같은 입력은 늘 같은 배치를 낸다 — 다시 누르는 것이 뽑기가 되지 않는다", () => {
    for (const mode of EXCAVATION_AUTO_MODES) {
      expect(autoAssignExcavation(candidates, mode)).toEqual(autoAssignExcavation([...candidates].reverse(), mode));
    }
  });

  it("후보가 모자라면 남는 자리는 빈 칸이다", () => {
    const one = autoAssignExcavation(candidates.slice(0, 1), "balanced");
    expect(one.filter((id) => id !== null)).toHaveLength(1);
    expect(autoAssignExcavation([], "gold")).toEqual([null, null, null]);
  });

  it("기준마다 이름이 있다", () => {
    for (const mode of EXCAVATION_AUTO_MODES) expect(EXCAVATION_AUTO_MODE_LABEL[mode].length).toBeGreaterThan(0);
  });
});
