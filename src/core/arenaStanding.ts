import type { DuelTierId } from "./duelArena";

/**
 * 아레나 — 실시간 밴픽 3대3의 **자리와 보상**에 관한 순수 규칙.
 *
 * 밴·배치·전투는 `liveArena.ts`가, 점수 증감과 주간 정산은 서버 SQL이 확정한다. 이 파일은 그 둘과
 * 화면(아레나 씬·프로필·친구·길드 카드·보상표)이 **같은 값**을 읽도록 표를 한 곳에 둔다 — SQL에 옮겨 적은
 * 수는 `arenaStanding.test`가 마이그레이션 원문과 대조한다.
 *
 * 결투장과 달리 판마다 주는 보상이 없다. 그 몫은 주마다 **마감 시점의 티어**와 **주간 순위**가 정하는
 * 우편 한 통이 갖는다(`arenaWeeklyReward`).
 */

/** 아레나 티어는 결투장 휘장 여섯 단계를 빌려 쓴다(단계 없이 한 칸씩). */
export type ArenaTierId = Extract<DuelTierId, "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master">;

export interface ArenaTierDef {
  id: ArenaTierId;
  /** 이 티어가 시작하는 RP. */
  floor: number;
  /** 주간 마감 때 이 티어에 서 있으면 받는 보상. */
  weeklyReward: { duelEmblem: number; gems: number };
}

/** 새 계정의 RP. 브론즈 한가운데서 시작한다. */
export const ARENA_START_SCORE = 1000;

export const ARENA_TIERS: readonly ArenaTierDef[] = [
  { id: "bronze", floor: 0, weeklyReward: { duelEmblem: 100, gems: 200 } },
  { id: "silver", floor: 1100, weeklyReward: { duelEmblem: 150, gems: 300 } },
  { id: "gold", floor: 1300, weeklyReward: { duelEmblem: 200, gems: 500 } },
  { id: "platinum", floor: 1500, weeklyReward: { duelEmblem: 300, gems: 600 } },
  { id: "diamond", floor: 1800, weeklyReward: { duelEmblem: 400, gems: 800 } },
  { id: "master", floor: 2100, weeklyReward: { duelEmblem: 500, gems: 1000 } },
];

/** 주간 순위 보너스(젬). 그 주 랭크전을 한 판이라도 한 계정끼리 RP로 줄을 세운다. 마지막 줄(`upTo: null`)은 0이다. */
export const ARENA_WEEKLY_RANK_GEMS: readonly { upTo: number | null; gems: number }[] = [
  { upTo: 1, gems: 2500 }, { upTo: 3, gems: 2000 }, { upTo: 10, gems: 1500 },
  { upTo: 50, gems: 1000 }, { upTo: 100, gems: 500 }, { upTo: null, gems: 0 },
];

/**
 * 연승 효과 — 이긴 판에 얹는 RP. 2연승부터 연승 한 단계마다 2점, 6연승의 10점에서 멈춘다(결투장과 같은 결).
 * 지면 연승이 0으로 돌아간다. 진 쪽이 잃는 RP는 늘지 않는다 — 연승은 상만 주고 벌을 키우지 않는다.
 */
export const ARENA_STREAK_BONUS = { from: 2, perStep: 2, max: 10 } as const;

/** 이 판으로 `streak`연승이 되었을 때 얹는 RP. */
export function arenaStreakBonus(streak: number): number {
  if (!Number.isFinite(streak) || streak < ARENA_STREAK_BONUS.from) return 0;
  return Math.min(ARENA_STREAK_BONUS.max, (Math.floor(streak) - ARENA_STREAK_BONUS.from + 1) * ARENA_STREAK_BONUS.perStep);
}

export function arenaTierIndex(score: number): number {
  let index = 0;
  ARENA_TIERS.forEach((tier, i) => { if (score >= tier.floor) index = i; });
  return index;
}

export function arenaTierId(score: number): ArenaTierId {
  return ARENA_TIERS[arenaTierIndex(score)].id;
}

export interface ArenaStandingView {
  tier: ArenaTierDef;
  index: number;
  /** 다음 티어 시작 RP. 맨 위면 null이다. */
  nextFloor: number | null;
  /** 지금 티어 안에서 다음 티어까지 온 몫(0~1). 맨 위는 1이다. */
  progress: number;
}

export function arenaStanding(score: number): ArenaStandingView {
  const index = arenaTierIndex(score);
  const tier = ARENA_TIERS[index];
  const next = ARENA_TIERS[index + 1];
  if (!next) return { tier, index, nextFloor: null, progress: 1 };
  // 브론즈는 0부터지만 실제로는 시작 RP 근처에서 논다 — 게이지는 시작 RP를 가운데 두고 잰다(900~1,100).
  const base = index === 0 ? 2 * ARENA_START_SCORE - next.floor : tier.floor;
  const span = Math.max(1, next.floor - base);
  return { tier, index, nextFloor: next.floor, progress: Math.max(0, Math.min(1, (score - base) / span)) };
}

/** 주간 순위가 받는 보너스 젬. 순위가 없으면(집계 밖) 0이다. */
export function arenaWeeklyRankGems(rank: number | null): number {
  if (rank === null || !Number.isFinite(rank) || rank < 1) return 0;
  return ARENA_WEEKLY_RANK_GEMS.find((row) => row.upTo === null || rank <= row.upTo)!.gems;
}

/** 주간 마감 우편 한 통 — 티어 보상 + 순위 보너스. */
export function arenaWeeklyReward(score: number, rank: number | null): { duelEmblem: number; gems: number } {
  const tier = ARENA_TIERS[arenaTierIndex(score)].weeklyReward;
  return { duelEmblem: tier.duelEmblem, gems: tier.gems + arenaWeeklyRankGems(rank) };
}

/** 프로필·친구·길드 카드가 함께 싣는 아레나 공개 값. 한 판도 하지 않았으면 싣지 않는다(「미배치」). */
export interface ArenaPublicStanding {
  score: number;
}

/** 저장·서버에서 읽은 값이 쓸 만한 RP인지. 아니면 그 칸을 세우지 않는다. */
export function arenaPublicStanding(value: unknown): ArenaPublicStanding | undefined {
  const score = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(score) && score >= 0 ? { score: Math.floor(score) } : undefined;
}
