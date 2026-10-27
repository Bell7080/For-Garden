/**
 * 길드전 — 방어진 칸 수·이틀 주기·점수 증감·매칭의 **순수 규칙**. 전투 자체는 `skirmish.ts`가 돈다.
 *
 * 하루는 UTC 날짜 기준이고 짝수 날은 정비일, 홀수 날은 전투일이다. 상대는 전투일이 시작하는 순간 정해져
 * 미리 알리지 않는다. 길드는 티어 없이 **길드전 점수**와 그 순서의 **등수**만 갖는다.
 */

export const GUILD_WAR_MIN_MEMBERS = 10;
export const GUILD_WAR_ATTACKS_PER_MEMBER = 3;
export const GUILD_WAR_START_SCORE = 1_000;

export type GuildWarPhase = "prep" | "battle";
/** 서버 시각(ms)이 속한 하루 번호(UTC). */
export const guildWarDayNumber = (ms: number): number => Math.floor(ms / 86_400_000);
export const guildWarPhase = (dayNumber: number): GuildWarPhase => (dayNumber % 2 === 0 ? "prep" : "battle");
/** 지금 국면이 끝나는 시각(다음 UTC 00:00). */
export const guildWarPhaseEndsAt = (ms: number): number => (guildWarDayNumber(ms) + 1) * 86_400_000;

export type GuildWarBranch = 1 | 2 | 3;
export interface GuildWarSlots { grunts: Record<GuildWarBranch, number> }
/** 일반 칸 수 — 레벨이 오를수록 늘고 제1지부 ≥ 제2지부 ≥ 제3지부다. 지부마다 우두머리 1 · 정예 2는 늘 있다. */
export const GUILD_WAR_GRUNTS: readonly (readonly [number, number, number])[] = [
  [2, 1, 0], [2, 1, 1], [3, 1, 1], [3, 2, 2], [4, 2, 2], [4, 3, 2], [5, 3, 3], [6, 4, 3], [6, 4, 4], [7, 4, 4],
];
export function guildWarSlots(level: number): GuildWarSlots {
  const row = GUILD_WAR_GRUNTS[Math.min(GUILD_WAR_GRUNTS.length, Math.max(1, Math.floor(level))) - 1];
  return { grunts: { 1: row[0], 2: row[1], 3: row[2] } };
}
/** 필수 9자리(지부마다 우두머리 1 + 정예 2) + 일반 칸 합. */
export const GUILD_WAR_REQUIRED_SLOTS = 9;
export const guildWarTotalSlots = (level: number): number => {
  const { grunts } = guildWarSlots(level);
  return GUILD_WAR_REQUIRED_SLOTS + grunts[1] + grunts[2] + grunts[3];
};

export type GuildWarSlotKind = "boss" | "elite" | "grunt";
/** 처음 격파했을 때 한 번 받는 점수와 지부 완전 점령 보너스. */
export const GUILD_WAR_SLOT_SCORE: Readonly<Record<GuildWarSlotKind, number>> = { grunt: 30, elite: 100, boss: 300 };
export const GUILD_WAR_BRANCH_SWEEP_BONUS = 150;

/** 정예가 열리려면 그 지부 일반 칸의 절반 이상(올림)을 격파해야 한다. 일반 칸이 없으면 곧바로 열린다. */
export const guildWarElitesOpen = (gruntCount: number, gruntsDown: number): boolean => gruntCount === 0 || gruntsDown >= Math.ceil(gruntCount / 2);
/** 우두머리는 정예 둘을 격파해야 열린다. */
export const guildWarBossOpen = (elitesDown: number): boolean => elitesDown >= 2;

// ── 점수 ───────────────────────────────────────────────────────────────────────

export type GuildWarOutcome = "win" | "loss" | "bye" | "forfeit";
export const GUILD_WAR_SCORE = { win: 25, loss: -15, bye: 10, forfeit: -10, gapStep: 50, gapBonusMax: 10 } as const;

/** 이긴 길드의 보너스 / 진 길드의 추가 감점은 상대와의 점수 차 50마다 1, 최대 10이다. */
function gapSteps(selfScore: number, opponentScore: number): number {
  return Math.min(GUILD_WAR_SCORE.gapBonusMax, Math.floor(Math.abs(opponentScore - selfScore) / GUILD_WAR_SCORE.gapStep));
}
/** 한 회차가 끝난 뒤 내 길드전 점수의 증감. 점수는 0 아래로 내려가지 않게 `applyGuildWarDelta`가 자른다. */
export function guildWarScoreDelta(outcome: GuildWarOutcome, selfScore: number, opponentScore: number): number {
  if (outcome === "bye") return GUILD_WAR_SCORE.bye;
  if (outcome === "forfeit") return GUILD_WAR_SCORE.forfeit;
  if (outcome === "win") return GUILD_WAR_SCORE.win + (opponentScore > selfScore ? gapSteps(selfScore, opponentScore) : 0);
  return GUILD_WAR_SCORE.loss - (opponentScore < selfScore ? gapSteps(selfScore, opponentScore) : 0);
}
export const applyGuildWarDelta = (score: number, delta: number): number => Math.max(0, score + delta);

/** 시즌이 넘어갈 때 점수를 절반쯤 되돌린다 — 위쪽 길드가 앞서 출발하되 따라잡을 수 있다. */
export const guildWarSeasonCarry = (score: number): number => GUILD_WAR_START_SCORE + Math.trunc((score - GUILD_WAR_START_SCORE) / 2);

// ── 등수·매칭 ──────────────────────────────────────────────────────────────────

export interface GuildWarStanding { guildId: string; score: number; reachedAt: number }
/** 점수 높은 순, 같은 점수는 먼저 도달한 길드가 위다. */
export function rankGuildWar<T extends GuildWarStanding>(entries: readonly T[]): (T & { rank: number })[] {
  return [...entries]
    .sort((a, b) => b.score - a.score || a.reachedAt - b.reachedAt || a.guildId.localeCompare(b.guildId))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export interface GuildWarPair { a: string; b: string | null }
/**
 * 방어진이 확정된 길드를 점수 순으로 줄 세워 이웃끼리 짝짓는다. 홀수면 마지막 길드는 부전승(`b: null`).
 * 지난 회차의 상대와 연속으로 만나는 짝은 이웃과 맞바꿔 피한다(바꿀 수 없으면 그대로 둔다).
 */
export function pairGuildsForWar(entries: readonly GuildWarStanding[], lastOpponent: ReadonlyMap<string, string> = new Map()): GuildWarPair[] {
  const order = rankGuildWar(entries).map((entry) => entry.guildId);
  const met = (x: string, y: string): boolean => lastOpponent.get(x) === y || lastOpponent.get(y) === x;
  for (let i = 0; i + 1 < order.length; i += 2) {
    if (!met(order[i], order[i + 1])) continue;
    // 다음 짝의 앞 길드와 맞바꿔 본다. 둘 다 새 짝이 되면 확정한다.
    const j = i + 2;
    if (j < order.length && !met(order[i + 1], order[j])) [order[i], order[j]] = [order[j], order[i]];
    else if (j < order.length && !met(order[i], order[j])) [order[i + 1], order[j]] = [order[j], order[i + 1]];
  }
  const pairs: GuildWarPair[] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push({ a: order[i], b: order[i + 1] ?? null });
  return pairs;
}
