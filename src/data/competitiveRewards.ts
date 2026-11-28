import { competitiveMonthlyOn } from "../core/competitiveSeason";
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

/**
 * 월간 시즌의 고대 지층 표(`competitiveMonthlyOn` — 2026-11-28 응태 「하위권도 맛있게 평탄화」). 위는 그대로 두고
 * 1,000위 밖 백분율·참여 몫만 한 단계씩 올렸다(참여 200 → 250). 공급량 표는 VERSION.md v0.566.0.
 */
export const ANCIENT_MONTHLY_RANK_REWARDS_V2: RankRewardTable = {
  ranks: [
    { upTo: 1, gems: 3000 }, { upTo: 2, gems: 2500 }, { upTo: 3, gems: 2000 }, { upTo: 10, gems: 1500 },
    { upTo: 50, gems: 1000 }, { upTo: 100, gems: 900 }, { upTo: 300, gems: 750 }, { upTo: 1000, gems: 650 },
  ],
  percents: [{ upToPercent: 10, gems: 550 }, { upToPercent: 30, gems: 450 }, { upToPercent: 50, gems: 350 }],
  participation: 250,
};

/** 지금 쓰는 고대 지층 표 — 월간 스위치가 켜지면 평탄화한 표다. */
export const ancientMonthlyRankRewards = (monthly: boolean = competitiveMonthlyOn()): RankRewardTable =>
  monthly ? ANCIENT_MONTHLY_RANK_REWARDS_V2 : ANCIENT_MONTHLY_RANK_REWARDS;

/** 표에서 그 자리의 젬. 서버(`server_ancient_monthly_rewards`)가 같은 규칙으로 고른다. */
export function rankRewardGems(table: RankRewardTable, rank: number, total: number): number {
  const byRank = table.ranks.find((row) => rank <= row.upTo);
  if (byRank) return byRank.gems;
  const percent = rank / Math.max(1, total) * 100;
  return table.percents.find((row) => percent <= row.upToPercent)?.gems ?? table.participation;
}

/** 순위 보상 한 묶음 — 우편에 함께 드는 재화(지갑 키)와 수량. */
export type RankRewardBundle = Partial<Record<"gems" | "duelEmblem" | "salvageRecord" | "gold" | "cheesecake", number>>;

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

/**
 * 길드 주간 순위 — 매주 월요일 00:00(UTC) 마감. 그 주 길드원 기여도의 합으로 줄을 세우고, 그 주에 기여도가 1 이상인
 * 길드원 모두가 길드 순위의 몫을 우편으로 받는다(한 사람은 한 주에 한 번 — 그 주 기여도가 가장 큰 길드의 몫).
 * 2026-10-28 응태 승인 — 공급량 표는 VERSION.md v0.378.0. 서버(`server_guild_weekly_rewards`)가 같은 표를 받는다.
 */
export const GUILD_WEEKLY_RANK_REWARDS: RankRewardTable = {
  ranks: [
    { upTo: 1, gems: 300 }, { upTo: 2, gems: 250 }, { upTo: 3, gems: 200 }, { upTo: 10, gems: 150 },
    { upTo: 50, gems: 120 }, { upTo: 100, gems: 100 }, { upTo: 300, gems: 80 }, { upTo: 1000, gems: 60 },
  ],
  percents: [{ upToPercent: 10, gems: 50 }, { upToPercent: 30, gems: 40 }, { upToPercent: 50, gems: 30 }],
  participation: 20,
};

/**
 * 수호전 일일 길드 순위 — 매일 00:00(UTC) 마감. **값은 젬이 아니라 길드 코인이다**(표 모양을 같이 쓰려고 칸 이름만 `gems`).
 * 그날 수호전을 한 판 이상 한 길드원이 그 길드 순위의 몫을 길드원 행의 코인으로 받는다(우편이 아니다 — 코인은 지갑에 없다).
 * 2026-10-28 응태 승인. DB 함수(`server_guild_settle_guard`)에 같은 표를 옮겨 적었고 `guildSql.test`가 대조한다.
 */
export const GUILD_GUARD_DAILY_RANK_COINS: RankRewardTable = {
  ranks: [
    { upTo: 1, gems: 30 }, { upTo: 3, gems: 25 }, { upTo: 10, gems: 20 }, { upTo: 50, gems: 15 }, { upTo: 100, gems: 12 }, { upTo: 1000, gems: 10 },
  ],
  percents: [{ upToPercent: 10, gems: 8 }, { upToPercent: 30, gems: 6 }, { upToPercent: 50, gems: 5 }],
  participation: 4,
};

/**
 * 결투장 월간 순위(`competitiveMonthlyOn` — 2026-11-28 응태 요청). 한 달이 닫히면 그 달 마지막 점수의 순위로 우편을 보낸다
 * (`server_competitive_rewards_v3`, 보드 `duel_month`). 티어 몫은 매주 따로 온다(`DuelTierDef.weeklyReward`).
 *
 * **위를 덜고 아래를 올렸다** — 예전(주간 순위 4주 + 21일 시즌 티어)에는 1위가 한 달 젬 약 16,700, 101위 밖 골드가 약 3,300이었고,
 * 1위(젬 8,000)와 참여(1,500)는 그대로 두고 그 사이를 한 칸마다 젬 500씩 오르게 끊었다(응태 2026-11-28 「칸마다 100개씩이라도 차이」).
 * 휘장은 50 단위다.
 */
export const DUEL_MONTHLY_RANK_REWARDS: RankRewardPool = {
  ranks: [
    { upTo: 1, rewards: { gems: 8000, duelEmblem: 700 } },
    { upTo: 2, rewards: { gems: 7000, duelEmblem: 600 } },
    { upTo: 3, rewards: { gems: 6000, duelEmblem: 550 } },
    { upTo: 10, rewards: { gems: 5500, duelEmblem: 500 } },
    { upTo: 50, rewards: { gems: 5000, duelEmblem: 450 } },
    { upTo: 100, rewards: { gems: 4500, duelEmblem: 400 } },
    { upTo: 300, rewards: { gems: 4000, duelEmblem: 350 } },
    { upTo: 1000, rewards: { gems: 3500, duelEmblem: 300 } },
  ],
  percents: [
    { upToPercent: 10, rewards: { gems: 3000, duelEmblem: 250 } },
    { upToPercent: 30, rewards: { gems: 2500, duelEmblem: 200 } },
    { upToPercent: 50, rewards: { gems: 2000, duelEmblem: 150 } },
  ],
  participation: { gems: 1500, duelEmblem: 100 },
};

/**
 * 아레나 월간 순위(같은 구조). 티어 몫은 지금처럼 매주(`ArenaTierDef.weeklyReward`)이고, 예전 주간 순위 젬(100위 밖 0)을 걷어 내고
 * 이 표가 한 달에 한 번 순위 몫을 준다 — 100위 밖도 참여 몫을 받는다.
 */
export const ARENA_MONTHLY_RANK_REWARDS: RankRewardPool = {
  ranks: [
    { upTo: 1, rewards: { gems: 7000 } }, { upTo: 2, rewards: { gems: 6000 } }, { upTo: 3, rewards: { gems: 5000 } },
    { upTo: 10, rewards: { gems: 4000 } }, { upTo: 50, rewards: { gems: 3000 } }, { upTo: 100, rewards: { gems: 2000 } },
    { upTo: 300, rewards: { gems: 1000 } }, { upTo: 1000, rewards: { gems: 800 } },
  ],
  percents: [{ upToPercent: 10, rewards: { gems: 700 } }, { upToPercent: 30, rewards: { gems: 600 } }, { upToPercent: 50, rewards: { gems: 500 } }],
  participation: { gems: 300 },
};
