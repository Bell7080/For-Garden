/** 주간 랭킹은 월요일 00:00 UTC에 마감하고 실제 대전/원정 기록이 있는 계정에 우편으로 지급한다. */
export const WEEKLY_RANK_GEMS = [
  { upTo: 1, gems: 3000 }, { upTo: 3, gems: 2500 }, { upTo: 10, gems: 2000 },
  { upTo: 50, gems: 1500 }, { upTo: 100, gems: 1000 }, { upTo: null, gems: 500 },
] as const;
export const competitiveRankGems = (rank: number): number => WEEKLY_RANK_GEMS.find(row => row.upTo === null || rank <= row.upTo)!.gems;

/**
 * 순위 보상표의 표준 모양(2026-10-27 응태 — 모든 랭킹 공통). 위는 고정 순위 구간, **1,000위 밖은 백분율 구간**, 맨 끝은 참여 보상이다.
 * 순위로만 끊으면 유저가 늘수록 1,000위 아래가 통째로 한 칸(혹은 0)에 몰린다 — 백분율은 몇 명이 오든 아래쪽 몫을 지킨다.
 */
export interface RankRewardTable {
  /** `upTo`위까지(오름차순). */
  readonly ranks: readonly { readonly upTo: number; readonly gems: number }[];
  /** 순위 구간 밖에서 상위 `upToPercent`%까지(오름차순). */
  readonly percents: readonly { readonly upToPercent: number; readonly gems: number }[];
  /** 기록이 있는 나머지 모두. */
  readonly participation: number;
}

/** 고대 지층 월간 순위 — 매달 1일 00:00(UTC) 마감, 그 달 최고층 순위로 우편 지급(1위 3,000). */
export const ANCIENT_MONTHLY_RANK_REWARDS: RankRewardTable = {
  ranks: [
    { upTo: 1, gems: 3000 }, { upTo: 2, gems: 2500 }, { upTo: 3, gems: 2000 }, { upTo: 10, gems: 1500 },
    { upTo: 50, gems: 1000 }, { upTo: 100, gems: 900 }, { upTo: 300, gems: 750 }, { upTo: 1000, gems: 600 },
  ],
  percents: [{ upToPercent: 10, gems: 500 }, { upToPercent: 30, gems: 400 }, { upToPercent: 50, gems: 300 }],
  participation: 200,
};

/** 표에서 그 자리의 젬. 서버(`server_ancient_monthly_rewards`)가 같은 규칙으로 고른다. */
export function rankRewardGems(table: RankRewardTable, rank: number, total: number): number {
  const byRank = table.ranks.find((row) => rank <= row.upTo);
  if (byRank) return byRank.gems;
  const percent = rank / Math.max(1, total) * 100;
  return table.percents.find((row) => percent <= row.upToPercent)?.gems ?? table.participation;
}

/** 순위 보상 한 묶음 — 우편에 함께 드는 재화(지갑 키)와 수량. */
export type RankRewardBundle = Partial<Record<"gems" | "salvageRecord" | "gold" | "cheesecake", number>>;

/**
 * 여러 재화를 함께 주는 순위 보상 풀 — 모양은 `RankRewardTable`과 같다(순위 구간 → 1,000위 밖 백분율 구간 → 참여).
 * 원정 주간 순위가 쓴다. 젬만 주는 표는 `rankTableAsPool`로 같은 모양이 되어 보상표 창이 한 길로 그린다.
 */
export interface RankRewardPool {
  readonly ranks: readonly { readonly upTo: number; readonly rewards: RankRewardBundle }[];
  readonly percents: readonly { readonly upToPercent: number; readonly rewards: RankRewardBundle }[];
  readonly participation: RankRewardBundle;
}

export const rankTableAsPool = (table: RankRewardTable): RankRewardPool => ({
  ranks: table.ranks.map((row) => ({ upTo: row.upTo, rewards: { gems: row.gems } })),
  percents: table.percents.map((row) => ({ upToPercent: row.upToPercent, rewards: { gems: row.gems } })),
  participation: { gems: table.participation },
});

/**
 * 풀에서 그 자리의 묶음. `total`(그 기간 참가자 수)을 모르면 1,000위 밖은 참여 몫으로 본다 — 모르는 값으로 더 주지 않는다.
 * 서버(`server_competitive_rewards_v2`)가 같은 규칙으로 고른다.
 */
export function rankRewardBundle(pool: RankRewardPool, rank: number, total: number = rank): RankRewardBundle {
  const byRank = pool.ranks.find((row) => rank <= row.upTo);
  if (byRank) return { ...byRank.rewards };
  const percent = rank / Math.max(1, total) * 100;
  return { ...(pool.percents.find((row) => percent <= row.upToPercent)?.rewards ?? pool.participation) };
}
