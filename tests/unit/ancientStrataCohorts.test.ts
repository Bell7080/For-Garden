import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { ANCIENT_GROWTH_COHORTS, ancientRegularParties, inspectAncientStableFrontier } from "../../src/core/ancientStrataCohorts";
import { ancientReferenceParty, ANCIENT_REFERENCE_PARTIES } from "../../src/core/ancientStrataSimulation";

describe("고대 지층 성장별 정규 파티", () => {
  it.each(ANCIENT_GROWTH_COHORTS)("$id의 모든 조합은 실제 플레이 가능한 탱커/딜러/지원가다", cohort => {
    const parties = ancientRegularParties(cohort);
    expect(parties.length).toBeGreaterThan(0);
    expect(new Set(parties.map(ids => ids.join(","))).size).toBe(parties.length);
    for (const ids of parties) {
      const [tank, dealer, support] = ids.map(getRelic);
      expect(tank.role).toBe("tank");
      expect(["warrior", "assassin"]).toContain(dealer.role);
      expect(support.role).toBe("support");
      expect(ids.every(id => !getRelic(id).enemyOnly && !getRelic(id).summonOnly)).toBe(true);
      const grades = new Set(ids.map(id => getRelic(id).rarity));
      expect(grades).toEqual(cohort.rarity === "mixed" ? new Set(["SR", "SSR"]) : new Set([cohort.rarity]));
    }
  });

  it("최소 돌파 단계는 20/30/40/50레벨에 각각 0/1/2/3으로 적용한다", () => {
    for (const [level, breakthrough] of [[20, 0], [30, 1], [40, 2], [50, 3]]) {
      const party = ancientReferenceParty(["torika", "luka", "stella"], "bare", level);
      expect(Object.values(party.breakthroughs)).toEqual([breakthrough, breakthrough, breakthrough]);
    }
  });

  it("기본 검수 프리셋에도 소환 전용 개체가 직접 편성되지 않는다", () => {
    for (const { relics } of ANCIENT_REFERENCE_PARTIES) expect(() => ancientReferenceParty(relics, "bare")).not.toThrow();
  });

  it("연속 안정 도달층은 첫 불안정 층까지만 검수하며 그 뒤 승리를 최고 도달층으로 추정하지 않는다", () => {
    const report = inspectAncientStableFrontier(["torika", "luka", "stella"], 20, "bare", [1729, 2531, 4099, 8191, 12289]);
    expect(report.floors.map(row => row.floor)).toEqual(Array.from({ length: report.floors.length }, (_, i) => i + 1));
    expect(report.floors.slice(0, -1).every(row => row.wins >= 4)).toBe(true);
    if (report.firstUnstableFloor !== null) {
      expect(report.floors.at(-1)?.floor).toBe(report.firstUnstableFloor);
      expect(report.floors.at(-1)!.wins).toBeLessThan(4);
      expect(report.stableThrough + 1).toBe(report.firstUnstableFloor);
    }
    expect(() => inspectAncientStableFrontier(["torika", "luka", "stella"], 20, "bare", [])).toThrow();
  });
});
