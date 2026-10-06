import { describe, expect, it } from "vitest";
import {
  applyDuelScore, DUEL_MAX_BLIND, DUEL_TIERS, duelBlindCount, duelBlindOrder, duelDivisionNumeral, duelExtraAttemptPrice,
  duelHiddenRelicIds, duelNewlyReachedTiers, duelRefreshPrice, duelScoreDelta, duelSeasonEndsAt, duelSeasonId,
  duelSeasonResetScore, duelStanding, pickDuelOpponents,
} from "../../src/core/duelArena";

describe("결투장 티어", () => {
  it("여덟 티어가 오름차순이고 다이아몬드까지만 네 단계다", () => {
    expect(DUEL_TIERS.map(({ id }) => id)).toEqual(["bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster", "challenger"]);
    DUEL_TIERS.forEach((tier, index) => { if (index > 0) expect(tier.floor).toBeGreaterThan(DUEL_TIERS[index - 1].floor); });
    expect(DUEL_TIERS.filter(({ divisions }) => divisions === 4).map(({ id }) => id)).toEqual(["bronze", "silver", "gold", "platinum", "diamond"]);
  });

  it("점수에서 티어·단계를 구한다", () => {
    expect(duelStanding(0)).toMatchObject({ tier: { id: "bronze" }, division: 4 });
    expect(duelStanding(399)).toMatchObject({ tier: { id: "bronze" }, division: 1 });
    expect(duelStanding(1_250)).toMatchObject({ tier: { id: "platinum" }, division: 4 });
    expect(duelStanding(2_100)).toMatchObject({ tier: { id: "master" }, division: null });
    expect(duelStanding(9_999).tier.id).toBe("challenger");
    expect(duelDivisionNumeral(4)).toBe("IV");
    expect(duelDivisionNumeral(null)).toBe("");
  });

  it("고티어일수록 가려지는 칸이 늘고 둘을 넘지 않는다", () => {
    expect(duelBlindCount(500)).toBe(0);
    expect(duelBlindCount(1_200)).toBe(1);
    expect(duelBlindCount(2_000)).toBe(2);
    expect(duelBlindCount(5_000)).toBe(DUEL_MAX_BLIND);
  });
});

describe("결투장 점수", () => {
  it("높은 상대를 이기면 더 오르고 낮은 상대에게 지면 더 내려간다", () => {
    expect(duelScoreDelta(1_000, 1_200, true)).toBeGreaterThan(duelScoreDelta(1_000, 800, true));
    expect(duelScoreDelta(1_000, 800, false)).toBeLessThan(duelScoreDelta(1_000, 1_200, false));
    expect(duelScoreDelta(1_000, 1_000, true)).toBe(20);
    expect(duelScoreDelta(1_000, 5_000, true)).toBe(32);
    expect(duelScoreDelta(1_000, 0, false)).toBe(-24);
  });

  it("다이아몬드까지는 티어 바닥 아래로 떨어지지 않고 마스터부터는 떨어진다", () => {
    expect(applyDuelScore(810, -24)).toBe(800);
    expect(applyDuelScore(2_010, -24)).toBe(1_986);
    expect(applyDuelScore(5, -24)).toBe(0);
  });

  it("새로 닿은 티어의 젬은 한 번만 준다", () => {
    expect(duelNewlyReachedTiers(390, 410, []).map(({ id }) => id)).toEqual(["silver"]);
    expect(duelNewlyReachedTiers(390, 410, ["silver"])).toEqual([]);
  });

  it("시즌 리셋은 60%를 단계 경계로 내린다", () => {
    expect(duelSeasonResetScore(2_850)).toBe(1_700);
    expect(duelSeasonResetScore(50)).toBe(0);
  });

  it("시즌은 28일마다 넘어간다", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    const ends = duelSeasonEndsAt(now);
    expect(ends.getTime()).toBeGreaterThan(now.getTime());
    expect(duelSeasonId(new Date(ends.getTime() - 1))).toBe(duelSeasonId(now));
    expect(duelSeasonId(ends)).not.toBe(duelSeasonId(now));
  });
});

describe("결투장 블라인드", () => {
  const members = [{ relicId: "a", power: 100 }, { relicId: "b", power: 300 }, { relicId: "c", power: 200 }];
  it("고르지 않으면 전투력이 높은 순으로 가린다", () => {
    expect(duelBlindOrder(members)).toEqual(["b", "c"]);
  });
  it("고른 것을 먼저 두고 편성에 없는 것은 버린다", () => {
    expect(duelBlindOrder(members, ["a", "zz"])).toEqual(["a", "b"]);
    expect(duelHiddenRelicIds(["a", "b"], 1)).toEqual(["a"]);
    expect(duelHiddenRelicIds(["a", "b"], 0)).toEqual([]);
  });
});

describe("결투장 상대 고르기·값", () => {
  it("낮음·비슷함·높음 셋을 점수 순으로 고른다", () => {
    const pool = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, score: i * 50 }));
    const picked = pickDuelOpponents(pool, 1_000, () => 0.5);
    expect(picked).toHaveLength(3);
    expect(picked[0].score).toBeLessThan(1_000);
    expect(picked[2].score).toBeGreaterThan(1_000);
  });
  it("후보가 모자라도 셋을 채운다", () => {
    const pool = [{ id: "x", score: 5_000 }, { id: "y", score: 5_100 }, { id: "z", score: 6_000 }];
    expect(pickDuelOpponents(pool, 0, () => 0)).toHaveLength(3);
  });
  it("추가 도전권과 새로고침의 값", () => {
    expect(duelExtraAttemptPrice(0)).toBe(50);
    expect(duelExtraAttemptPrice(99)).toBeUndefined();
    expect(duelRefreshPrice(0)).toBe(0);
    expect(duelRefreshPrice(3)).toBeGreaterThan(0);
  });
});

describe("결투장 표본 상대", async () => {
  const { duelNpcPool } = await import("../../src/core/duelNpcPool");
  it("같은 시즌이면 같은 사람이 같은 편성으로 선다", () => {
    const a = duelNpcPool("S1");
    expect(a).toHaveLength(240);
    expect(duelNpcPool("S1")[7]).toEqual(a[7]);
    expect(duelNpcPool("S2").map(({ score }) => score)).not.toEqual(a.map(({ score }) => score));
  });
  it("세 명이 겹치지 않고 점수대만큼 자란다", () => {
    for (const npc of duelNpcPool("S3")) {
      expect(new Set(npc.units.map(({ relicId }) => relicId)).size).toBe(3);
      expect(npc.blindOrder).toHaveLength(2);
    }
    const pool = duelNpcPool("S3");
    const low = pool.reduce((a, b) => (a.score < b.score ? a : b));
    const high = pool.reduce((a, b) => (a.score > b.score ? a : b));
    expect(high.units[0].level).toBeGreaterThan(low.units[0].level);
    expect(pool.some(({ score }) => score >= 2_800)).toBe(true);
  });
});
