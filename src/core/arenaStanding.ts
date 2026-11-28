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
  /** 월간 전환(`competitiveMonthlyOn`) 뒤의 매주 티어 몫 — 예전 주간 순위 젬을 걷어 낸 만큼 젬을 올렸다(응태 승인 2026-11-28). */
  monthlyWeeklyReward: { duelEmblem: number; gems: number };
}

/** 새 계정의 RP. 브론즈 한가운데서 시작한다. */
export const ARENA_START_SCORE = 1000;

export const ARENA_TIERS: readonly ArenaTierDef[] = [
  { id: "bronze", floor: 0, weeklyReward: { duelEmblem: 100, gems: 200 }, monthlyWeeklyReward: { duelEmblem: 100, gems: 200 } },
  { id: "silver", floor: 1100, weeklyReward: { duelEmblem: 150, gems: 300 }, monthlyWeeklyReward: { duelEmblem: 150, gems: 300 } },
  { id: "gold", floor: 1300, weeklyReward: { duelEmblem: 200, gems: 500 }, monthlyWeeklyReward: { duelEmblem: 200, gems: 500 } },
  { id: "platinum", floor: 1500, weeklyReward: { duelEmblem: 300, gems: 600 }, monthlyWeeklyReward: { duelEmblem: 300, gems: 800 } },
  { id: "diamond", floor: 1800, weeklyReward: { duelEmblem: 400, gems: 800 }, monthlyWeeklyReward: { duelEmblem: 400, gems: 1200 } },
  { id: "master", floor: 2100, weeklyReward: { duelEmblem: 500, gems: 1000 }, monthlyWeeklyReward: { duelEmblem: 500, gems: 1800 } },
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

/**
 * 저티어 발판 — 이긴 쪽의 RP가 그 판의 기본 증감에 곱해져 크게 오른다. 진 쪽이 잃는 몫은 기본 그대로다.
 * 이긴 쪽의 **판 시작 RP**가 `below` 미만인 첫 줄이 곱을 정한다(브론즈 1,100 미만 · 실버 1,300 미만).
 * SQL(`server_arena_commit`)에 같은 수가 적혀 있고 `arenaStanding.test`가 마이그레이션 원문과 대조한다.
 */
export const ARENA_LOW_TIER_WIN: readonly { below: number; multiplier: number }[] = [
  { below: 1100, multiplier: 2 },
  { below: 1300, multiplier: 1.5 },
];

/** 이긴 쪽의 판 시작 RP로 정하는 승리 증감의 배수. 저티어가 아니면 1이다. */
export function arenaWinMultiplier(winnerScore: number): number {
  return ARENA_LOW_TIER_WIN.find((row) => winnerScore < row.below)?.multiplier ?? 1;
}

/** 한 판의 RP 증감(연승 보너스 제외). 이긴 쪽은 `winner`, 진 쪽은 `-loser`다 — SQL과 같은 식이다. */
export function arenaScoreDelta(winnerScore: number, loserScore: number): { winner: number; loser: number } {
  const base = Math.max(8, Math.min(40, Math.round(32 * (1 - 1 / (1 + 10 ** ((loserScore - winnerScore) / 400))))));
  return { winner: Math.round(base * arenaWinMultiplier(winnerScore)), loser: base };
}

export function arenaTierIndex(score: number): number {
  let index = 0;
  ARENA_TIERS.forEach((tier, i) => { if (score >= tier.floor) index = i; });
  return index;
}

/**
 * 월간 시즌이 넘어갈 때의 RP — 시작값 위의 몫을 절반 남겨 50 단위로 내린다(마스터 2,400 → 1,700). 시작값 아래는 시작값으로 돌아온다.
 * 서버 `server_arena_season_reset`이 같은 식이다(`arenaStanding.test`).
 */
export function arenaSeasonResetScore(score: number): number {
  return ARENA_START_SCORE + Math.floor(Math.max(0, score - ARENA_START_SCORE) * 0.5 / 50) * 50;
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

/**
 * 결과판의 RP 게이지가 지나는 줄 — 결투장(`duelGaugeSteps`)과 같은 모양이라 같은 블록(`addDuelStandingRow`)이 그린다.
 * 아레나는 단계가 없어 한 줄이 티어 하나이고, 게이지 칸 나눔은 로비(`arenaStanding`)와 같다(브론즈는 900~1,100).
 */
export interface ArenaGaugeStep {
  tierId: ArenaTierId;
  division: null;
  floor: number;
  ceil: number;
  top: boolean;
  from: number;
  to: number;
}

function arenaGaugeRange(index: number): Omit<ArenaGaugeStep, "from" | "to"> {
  const tier = ARENA_TIERS[index];
  const next = ARENA_TIERS[index + 1];
  if (!next) return { tierId: tier.id, division: null, floor: tier.floor, ceil: tier.floor, top: true };
  const floor = index === 0 ? 2 * ARENA_START_SCORE - next.floor : tier.floor;
  return { tierId: tier.id, division: null, floor, ceil: next.floor, top: false };
}

/** RP `before` → `after`로 가는 동안 지나는 줄을 차례로. 같으면 서 있는 줄 하나다. */
export function arenaGaugeSteps(before: number, after: number): ArenaGaugeStep[] {
  const start = Math.max(0, Math.floor(before));
  const end = Math.max(0, Math.floor(after));
  const ratio = (range: Omit<ArenaGaugeStep, "from" | "to">, score: number): number =>
    range.top ? 1 : Math.min(1, Math.max(0, (score - range.floor) / Math.max(1, range.ceil - range.floor)));
  const steps: ArenaGaugeStep[] = [];
  let index = arenaTierIndex(start);
  let range = arenaGaugeRange(index);
  let from = ratio(range, start);
  for (let guard = 0; guard < ARENA_TIERS.length * 2; guard += 1) {
    if (end > start && !range.top && end >= range.ceil) {
      steps.push({ ...range, from, to: 1 });
      index += 1; range = arenaGaugeRange(index); from = 0;
    } else if (end < start && index > 0 && end < ARENA_TIERS[index].floor) {
      steps.push({ ...range, from, to: 0 });
      index -= 1; range = arenaGaugeRange(index); from = 1;
    } else {
      steps.push({ ...range, from, to: ratio(range, end) });
      break;
    }
  }
  return steps;
}
