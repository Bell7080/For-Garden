import { describe, expect, it } from "vitest";
import { ANCIENT_MONTHLY_RANK_REWARDS, rankRewardBundle, rankRewardGems, rankTableAsPool } from "../../src/data/competitiveRewards";
import { EXPEDITION_WEEKLY_RANK_POOL, expeditionRankRewards } from "../../src/data/expedition";

describe("표준 순위 보상 풀", () => {
  it("순위 구간 → 1,000위 밖 백분율 → 참여 순으로 고른다", () => {
    expect(expeditionRankRewards(1)).toEqual({ gems: 3000, salvageRecord: 400, gold: 5000, cheesecake: 150 });
    expect(expeditionRankRewards(250).gold).toBe(2500);
    expect(expeditionRankRewards(1000).gold).toBe(2000);
    expect(expeditionRankRewards(1001, 20_000).gold).toBe(1500); // 상위 5%
    expect(expeditionRankRewards(5000, 20_000).gold).toBe(1200); // 상위 25%
    expect(expeditionRankRewards(9000, 20_000).gold).toBe(1000); // 상위 45%
    expect(expeditionRankRewards(19_000, 20_000)).toEqual(EXPEDITION_WEEKLY_RANK_POOL.participation);
  });

  it("참가자 수를 모르면 1,000위 밖은 참여 몫이다 — 모르는 값으로 더 주지 않는다", () => {
    expect(expeditionRankRewards(1500)).toEqual(EXPEDITION_WEEKLY_RANK_POOL.participation);
  });

  it("1,000위 밖 누구도 젬·인양 기록을 예전(500·80)보다 덜 받지 않는다", () => {
    for (const rank of [101, 999, 1001, 50_000]) {
      const bundle = expeditionRankRewards(rank, 60_000);
      expect(bundle.gems).toBe(500);
      expect(bundle.salvageRecord).toBe(80);
    }
  });

  it("젬만 주는 표(고대 지층)도 같은 풀 모양으로 읽으면 같은 값을 고른다", () => {
    const pool = rankTableAsPool(ANCIENT_MONTHLY_RANK_REWARDS);
    for (const [rank, total] of [[1, 10], [77, 500], [1200, 30_000], [9000, 30_000], [29_000, 30_000]]) {
      expect(rankRewardBundle(pool, rank, total).gems).toBe(rankRewardGems(ANCIENT_MONTHLY_RANK_REWARDS, rank, total));
    }
  });
});
