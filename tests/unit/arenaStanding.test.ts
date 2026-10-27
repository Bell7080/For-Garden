import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ARENA_LOW_TIER_WIN, arenaScoreDelta, arenaWinMultiplier, ARENA_TIERS, arenaStanding, arenaStreakBonus, arenaTierId, arenaWeeklyReward, arenaWeeklyRankGems, arenaPublicStanding } from '../../src/core/arenaStanding';
import { ARENA_WEEKLY_RANK_GEMS } from '../../src/core/arenaStanding';
import { WEEKLY_RANK_GEMS } from '../../src/data/competitiveRewards';
import { DUEL_TIERS } from '../../src/core/duelArena';

const clean = (gems: number) => gems % (gems >= 1000 ? 500 : 100) === 0;

describe('아레나 저티어 발판', () => {
  it('브론즈 ×2 · 실버 ×1.5 · 골드부터 1배이고 진 쪽 몫은 그대로다', () => {
    expect(arenaWinMultiplier(1000)).toBe(2);
    expect(arenaWinMultiplier(1100)).toBe(1.5);
    expect(arenaWinMultiplier(1300)).toBe(1);
    expect(arenaScoreDelta(1000, 1000)).toEqual({ winner: 32, loser: 16 });
    expect(arenaScoreDelta(1400, 1400)).toEqual({ winner: 16, loser: 16 });
  });
  it('배수 경계는 티어 바닥과 같고 SQL 원문에도 같은 수가 있다', () => {
    expect(ARENA_LOW_TIER_WIN.map((row) => row.below)).toEqual([ARENA_TIERS[1].floor, ARENA_TIERS[2].floor]);
    const sql = readFileSync('supabase/migrations/20261031010000_low_tier_scores.sql', 'utf8');
    expect(sql).toContain('case when sa<1100 then 2 when sa<1300 then 1.5 else 1 end');
  });
});

describe('아레나 자리', () => {
  it('RP 문턱마다 티어가 오르고 게이지는 다음 문턱까지 찬다', () => {
    expect(arenaTierId(0)).toBe('bronze');
    expect(arenaTierId(1100)).toBe('silver');
    expect(arenaTierId(2100)).toBe('master');
    const mid = arenaStanding(1200);
    expect(mid.tier.id).toBe('silver');
    expect(mid.nextFloor).toBe(1300);
    expect(mid.progress).toBeCloseTo(0.5);
  });
  it('연승 효과는 2연승부터 2점씩 10점에서 멈춘다', () => {
    expect([0, 1, 2, 3, 6, 20].map(arenaStreakBonus)).toEqual([0, 0, 2, 4, 10, 10]);
  });
  it('주간 보상은 티어 몫과 순위 몫을 더하고 101위 밖은 티어 몫만이다', () => {
    expect(arenaWeeklyRankGems(1)).toBe(2500);
    expect(arenaWeeklyRankGems(150)).toBe(0);
    expect(arenaWeeklyReward(2200, 1)).toEqual({ duelEmblem: 500, gems: 3500 });
  });
  it('보상 젬은 깔끔한 단위로 떨어진다', () => {
    const all = [...ARENA_TIERS.map((t) => t.weeklyReward.gems), ...ARENA_WEEKLY_RANK_GEMS.map((r) => r.gems), ...WEEKLY_RANK_GEMS.map((r) => r.gems), ...DUEL_TIERS.map((t) => t.seasonReward.gems)];
    expect(all.filter((gems) => !clean(gems))).toEqual([]);
  });
  it('공개 값은 숫자 RP만 받는다', () => {
    expect(arenaPublicStanding(1342)).toEqual({ score: 1342 });
    expect(arenaPublicStanding('x')).toBeUndefined();
  });
});
