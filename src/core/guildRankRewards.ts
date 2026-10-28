/**
 * 길드 순위 보상의 줄 세우기 — 길드 주간 순위(기여도 합)와 수호전 일일 길드 순위(최고 점수 합)가 같은 규칙을 쓴다.
 * 점수가 있는 길드만 줄에 서고, 점수가 같으면 길드 id 순이다. DB 함수(`server_guild_rank_results`)가 같은 순서로 판정한다.
 * 표는 `src/data/competitiveRewards.ts`(`GUILD_WEEKLY_RANK_REWARDS`·`GUILD_GUARD_DAILY_RANK_COINS`)가 갖는다.
 */
export interface GuildScoreEntry { guildId: string; score: number }

export function rankGuildScores<T extends GuildScoreEntry>(entries: readonly T[]): (T & { rank: number })[] {
  return entries.filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.guildId < b.guildId ? -1 : a.guildId > b.guildId ? 1 : 0))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** 지난 주(월요일 키) — `guildWeekKey`가 낸 키에서 7일 앞이다. */
export function previousGuildWeek(week: string): string {
  return new Date(Date.parse(`${week}T00:00:00.000Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
}
