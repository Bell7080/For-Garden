import { describe, expect, it } from "vitest";
import {
  applyGuildWarDelta, GUILD_WAR_GRUNTS, GUILD_WAR_REQUIRED_SLOTS, guildWarBossOpen, guildWarDayNumber, guildWarElitesOpen, guildWarPhase,
  guildWarPhaseEndsAt, guildWarScoreDelta, guildWarSeasonCarry, guildWarSlots, guildWarTotalSlots, pairGuildsForWar, rankGuildWar,
} from "../../src/core/guildWar";
import { guildCapacity } from "../../src/core/guild";

describe("길드전 방어 칸", () => {
  it("은 레벨이 오를수록 늘고 제1지부가 가장 많다", () => {
    GUILD_WAR_GRUNTS.forEach(([a, b, c], i) => {
      expect(a).toBeGreaterThanOrEqual(b);
      expect(b).toBeGreaterThanOrEqual(c);
      if (i > 0) expect(a + b + c).toBeGreaterThanOrEqual(GUILD_WAR_GRUNTS[i - 1].reduce((x, y) => x + y, 0));
    });
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(guildWarTotalSlots)).toEqual([12, 13, 14, 16, 17, 18, 20, 22, 23, 24]);
    expect(guildWarSlots(10).grunts).toEqual({ 1: 7, 2: 4, 3: 4 });
    expect(GUILD_WAR_REQUIRED_SLOTS).toBe(9);
  });

  it("의 방어 칸은 정원을 넘지 않는다", () => {
    for (let level = 1; level <= 10; level++) expect(guildWarTotalSlots(level)).toBeLessThanOrEqual(guildCapacity(level));
  });

  it("의 개방 순서: 일반 절반 → 정예 → 우두머리", () => {
    expect(guildWarElitesOpen(0, 0)).toBe(true);
    expect(guildWarElitesOpen(3, 1)).toBe(false);
    expect(guildWarElitesOpen(3, 2)).toBe(true);
    expect(guildWarElitesOpen(2, 1)).toBe(true);
    expect(guildWarBossOpen(1)).toBe(false);
    expect(guildWarBossOpen(2)).toBe(true);
  });
});

describe("길드전 이틀 주기", () => {
  it("은 짝수 날이 정비일, 홀수 날이 전투일이다", () => {
    const day = guildWarDayNumber(Date.UTC(2026, 9, 17, 12));
    expect(guildWarPhase(day)).not.toBe(guildWarPhase(day + 1));
    expect(guildWarPhase(day)).toBe(guildWarPhase(day + 2));
    expect(guildWarPhaseEndsAt(Date.UTC(2026, 9, 17, 12))).toBe(Date.UTC(2026, 9, 18));
  });
});

describe("길드전 점수", () => {
  it("은 이기면 오르고 지면 내리며 격차 보너스에 상한이 있다", () => {
    expect(guildWarScoreDelta("win", 1_000, 1_000)).toBe(25);
    expect(guildWarScoreDelta("win", 1_000, 1_200)).toBe(29);
    expect(guildWarScoreDelta("win", 1_000, 5_000)).toBe(35);
    expect(guildWarScoreDelta("win", 1_200, 1_000)).toBe(25);
    expect(guildWarScoreDelta("loss", 1_000, 1_000)).toBe(-15);
    expect(guildWarScoreDelta("loss", 1_200, 1_000)).toBe(-19);
    expect(guildWarScoreDelta("loss", 5_000, 100)).toBe(-25);
    expect(guildWarScoreDelta("bye", 1_000, 0)).toBe(10);
    expect(guildWarScoreDelta("forfeit", 1_000, 0)).toBe(-10);
    expect(applyGuildWarDelta(5, -15)).toBe(0);
  });

  it("은 시즌이 넘어가면 절반쯤 되돌아온다", () => {
    expect(guildWarSeasonCarry(1_400)).toBe(1_200);
    expect(guildWarSeasonCarry(600)).toBe(800);
    expect(guildWarSeasonCarry(1_000)).toBe(1_000);
  });
});

describe("길드전 등수와 매칭", () => {
  const e = (guildId: string, score: number, reachedAt = 0) => ({ guildId, score, reachedAt });
  it("은 점수순이고 같은 점수는 먼저 도달한 길드가 위다", () => {
    expect(rankGuildWar([e("b", 1_000, 5), e("a", 1_000, 2), e("c", 1_200, 9)]).map((x) => [x.guildId, x.rank])).toEqual([["c", 1], ["a", 2], ["b", 3]]);
  });

  it("은 이웃끼리 짝짓고 홀수면 꼴찌가 부전승이다", () => {
    expect(pairGuildsForWar([e("a", 1_300), e("b", 1_200), e("c", 1_100), e("d", 1_000), e("e", 900)])).toEqual([
      { a: "a", b: "b" }, { a: "c", b: "d" }, { a: "e", b: null },
    ]);
  });

  it("은 지난 상대와 연속으로 만나는 짝을 이웃과 맞바꿔 피한다", () => {
    const pairs = pairGuildsForWar([e("a", 4), e("b", 3), e("c", 2), e("d", 1)], new Map([["a", "b"]]));
    expect(pairs.some((p) => (p.a === "a" && p.b === "b") || (p.a === "b" && p.b === "a"))).toBe(false);
    expect(pairs.flatMap((p) => [p.a, p.b]).sort()).toEqual(["a", "b", "c", "d"]);
  });
});
