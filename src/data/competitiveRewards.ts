/** 주간 랭킹은 월요일 00:00 UTC에 마감하고 실제 대전/원정 기록이 있는 계정에 우편으로 지급한다. */
export const WEEKLY_RANK_GEMS = [
  { upTo: 1, gems: 3000 }, { upTo: 3, gems: 2500 }, { upTo: 10, gems: 2000 },
  { upTo: 50, gems: 1500 }, { upTo: 100, gems: 1000 }, { upTo: null, gems: 500 },
] as const;
export const competitiveRankGems = (rank: number): number => WEEKLY_RANK_GEMS.find(row => row.upTo === null || rank <= row.upTo)!.gems;
