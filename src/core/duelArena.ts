import { applyBreakthrough, applyLevelGrowth } from "./relicProgression";
import type { RelicDef, Stats } from "./types";

/**
 * 결투장 — 3대3 자동전투 비동기 방어전의 **순수 규칙**.
 *
 * 점수·티어·블라인드·도전권·보상·시즌의 값은 이 파일 한 곳이 갖는다. 서버(`FakeServer`)는 이
 * 함수들로 상태를 확정하고, 화면은 서버가 돌려준 값을 그리기만 한다 — 화면이 점수 증감을 다시
 * 셈하면 결과판과 서버가 다른 수를 말한다. Phaser를 모르고 난수는 인자로 받는다.
 *
 * **전투 자체는 여기서 만들지 않는다** — 3대3도 `skirmish.ts` 하나가 돈다. 결투장이 바꾸는 것은
 * 누가 서는가(상대의 방어덱 스냅샷)와 궁극기를 사람이 누르지 못한다는 것뿐이다.
 */

/** 여덟 단계. 순서가 곧 높이다. */
export type DuelTierId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "grandmaster" | "challenger";

export interface DuelTierDef {
  id: DuelTierId;
  /** 이 티어가 시작하는 점수. */
  floor: number;
  /** 단계 수(IV~I). 마스터부터는 단계 없이 한 칸이다. */
  divisions: number;
  /**
   * 이 티어에서 싸우는 상대 방어덱 중 **가려지는 칸 수**.
   *
   * 높이 올라갈수록 상대를 다 보고 고르는 판이 아니라 일부를 짐작하고 거는 판이 된다 — 같은
   * 점수대끼리는 편성 수 싸움이 승부를 가르므로, 가린 칸이 그 수 싸움을 만든다.
   */
  blind: number;
  /** 시즌 종료 정산(투사의 휘장·젬). */
  seasonReward: { duelEmblem: number; gems: number };
  /** 처음 닿았을 때 한 번 받는 젬. 브론즈는 시작 티어라 없다. */
  firstReachGems: number;
}

/** 단계 하나의 폭. 다이아몬드까지는 티어 하나가 네 단계(400점)다. */
export const DUEL_DIVISION_SPAN = 100;

export const DUEL_TIERS: readonly DuelTierDef[] = [
  { id: "bronze", floor: 0, divisions: 4, blind: 0, seasonReward: { duelEmblem: 150, gems: 0 }, firstReachGems: 0 },
  { id: "silver", floor: 400, divisions: 4, blind: 0, seasonReward: { duelEmblem: 250, gems: 50 }, firstReachGems: 100 },
  { id: "gold", floor: 800, divisions: 4, blind: 0, seasonReward: { duelEmblem: 400, gems: 100 }, firstReachGems: 150 },
  { id: "platinum", floor: 1_200, divisions: 4, blind: 1, seasonReward: { duelEmblem: 550, gems: 150 }, firstReachGems: 200 },
  { id: "diamond", floor: 1_600, divisions: 4, blind: 1, seasonReward: { duelEmblem: 700, gems: 200 }, firstReachGems: 300 },
  { id: "master", floor: 2_000, divisions: 1, blind: 2, seasonReward: { duelEmblem: 900, gems: 300 }, firstReachGems: 400 },
  { id: "grandmaster", floor: 2_400, divisions: 1, blind: 2, seasonReward: { duelEmblem: 1_100, gems: 400 }, firstReachGems: 500 },
  { id: "challenger", floor: 2_800, divisions: 1, blind: 2, seasonReward: { duelEmblem: 1_400, gems: 500 }, firstReachGems: 700 },
];

/** 가려지는 칸의 상한. 셋 중 하나는 늘 보여야 고를 근거가 남는다. */
export const DUEL_MAX_BLIND = 2;

/** 새 계정과 시즌 첫 판의 점수. */
export const DUEL_START_SCORE = 0;

/** 하루 무료 도전권. 입장에서 한 장을 쓴다(중간에 끊어도 돌려주지 않는다 — 판을 고르는 요령이 생긴다). */
export const DUEL_DAILY_ATTEMPTS = 5;
/** 젬으로 더 사는 도전권 — 오늘 몇 번째 구매인지가 값을 정한다. 길이가 곧 하루 한도다. */
export const DUEL_EXTRA_ATTEMPT_PRICES: readonly number[] = [50, 50, 100, 100, 150];
/** 상대 후보 새로고침 — 하루 무료 횟수. */
export const DUEL_FREE_REFRESHES = 3;
/**
 * 무료를 다 쓴 뒤의 젬 값 — 오늘 몇 번째 유료 새로고침인지가 값을 정하고 끝 값에서 멈춘다.
 * 값이 늘 같으면 마음에 드는 상대가 설 때까지 젬으로 돌리는 것이 언제나 남는 장사다.
 */
export const DUEL_REFRESH_PRICES: readonly number[] = [20, 40, 60, 80, 100];
/** 한 번에 세우는 상대 후보 수. */
export const DUEL_OPPONENT_COUNT = 5;

/**
 * 연승 보너스 — 이긴 판에 얹는 점수. 2연승부터 연승 한 단계마다 2점, 6연승의 10점에서 멈춘다.
 *
 * 점수만 얹고 휘장·보상은 건드리지 않는다. 지면 연승이 0으로 돌아가고, 시즌이 넘어가도 0이다.
 */
export const DUEL_STREAK_BONUS = { from: 2, perStep: 2, max: 10 } as const;

/** 이 판으로 `streak`연승이 되었을 때 얹는 점수. */
export function duelStreakBonus(streak: number): number {
  if (!Number.isFinite(streak) || streak < DUEL_STREAK_BONUS.from) return 0;
  return Math.min(DUEL_STREAK_BONUS.max, (Math.floor(streak) - DUEL_STREAK_BONUS.from + 1) * DUEL_STREAK_BONUS.perStep);
}

/** 한 판의 투사의 휘장. 진 판도 조금 준다 — 도전권을 쓴 몫이다. */
export const DUEL_BATTLE_REWARD = { win: 20, loss: 8 } as const;

/** 시즌 길이와 기준점(월요일 00:00 UTC). 시즌 번호는 이 기준에서 몇 번째 28일인가다. */
export const DUEL_SEASON_DAYS = 28;
const DUEL_SEASON_EPOCH = Date.UTC(2026, 0, 5);
const DAY_MS = 86_400_000;

export function duelTierIndex(score: number): number {
  let index = 0;
  DUEL_TIERS.forEach((tier, i) => { if (score >= tier.floor) index = i; });
  return index;
}

export function duelTier(score: number): DuelTierDef {
  return DUEL_TIERS[duelTierIndex(score)];
}

export function getDuelTier(id: string): DuelTierDef | undefined {
  return DUEL_TIERS.find((tier) => tier.id === id);
}

export interface DuelStanding {
  tier: DuelTierDef;
  /** 4(IV)~1(I). 단계가 없는 티어는 null이다. */
  division: number | null;
  /** 다음 단계(또는 다음 티어)까지의 진행 0~1. 맨 위 티어는 1로 둔다. */
  progress: number;
}

/** 점수 → 티어·단계. 화면의 표식과 서버의 정산이 같은 함수를 읽는다. */
export function duelStanding(score: number): DuelStanding {
  const index = duelTierIndex(score);
  const tier = DUEL_TIERS[index];
  const next = DUEL_TIERS[index + 1];
  const within = Math.max(0, score - tier.floor);
  if (tier.divisions > 1) {
    const step = Math.min(tier.divisions - 1, Math.floor(within / DUEL_DIVISION_SPAN));
    return { tier, division: tier.divisions - step, progress: Math.min(1, (within - step * DUEL_DIVISION_SPAN) / DUEL_DIVISION_SPAN) };
  }
  return { tier, division: null, progress: next ? Math.min(1, within / (next.floor - tier.floor)) : 1 };
}

/** 단계 숫자를 로마자로. 표기 자체는 언어와 무관하다. */
export function duelDivisionNumeral(division: number | null): string {
  return division === null ? "" : (["", "I", "II", "III", "IV"][division] ?? "");
}

/**
 * 한 판의 점수 증감.
 *
 * 엘로를 단순하게 줄인 꼴이다 — 높은 상대를 이기면 더 오르고, 낮은 상대에게 지면 더 내려간다.
 * 상대와의 점수 차 25점마다 1점씩 기울고 양 끝은 막아 둔다(이겨도 최소 10, 져도 최대 24).
 */
export function duelScoreDelta(myScore: number, opponentScore: number, won: boolean): number {
  const gap = opponentScore - myScore;
  if (won) return clamp(Math.round(20 + gap / 25), 10, 32);
  return -clamp(Math.round(14 - gap / 25), 6, 24);
}

/**
 * 점수에 증감을 적용한다.
 *
 * **다이아몬드까지는 티어 바닥 아래로 떨어지지 않는다**(강등 보호) — 단계는 내려가도 티어는
 * 지킨다. 마스터부터는 보호가 없다: 단계 없이 순위로 겨루는 자리라 내려갈 수 있어야 자리가 돈다.
 */
export function applyDuelScore(score: number, delta: number): number {
  const next = Math.max(0, score + delta);
  if (delta >= 0) return next;
  const tier = duelTier(score);
  return tier.divisions > 1 ? Math.max(tier.floor, next) : next;
}

/** 이 점수대에서 상대 방어덱이 몇 칸 가려지는가. 싸우는 판의 높이 — 도전하는 쪽의 티어로 정한다. */
export function duelBlindCount(score: number): number {
  return Math.min(DUEL_MAX_BLIND, duelTier(score).blind);
}

/**
 * 방어덱에서 가릴 렐릭의 **우선순위**.
 *
 * 사람이 고른 것을 앞에 두고, 모자라면 전투력이 높은 개체부터 채운다 — 처음 방어덱을 세우면
 * 저절로 가장 센 둘이 가려지고, 직접 고르면 그 선택이 먼저다. 편성에서 빠진 개체는 버린다.
 */
export function duelBlindOrder(members: readonly { relicId: string; power: number }[], chosen: readonly string[] = []): string[] {
  const ids = new Set(members.map(({ relicId }) => relicId));
  const picked = [...new Set(chosen.filter((id) => ids.has(id)))].slice(0, DUEL_MAX_BLIND);
  const rest = [...members]
    .filter(({ relicId }) => !picked.includes(relicId))
    .sort((a, b) => b.power - a.power || members.indexOf(a) - members.indexOf(b))
    .map(({ relicId }) => relicId);
  return [...picked, ...rest].slice(0, DUEL_MAX_BLIND);
}

/** 실제로 가려지는 렐릭. 우선순위의 앞에서부터 그 판의 칸 수만큼이다. */
export function duelHiddenRelicIds(blindOrder: readonly string[], count: number): string[] {
  return blindOrder.slice(0, Math.max(0, Math.min(DUEL_MAX_BLIND, count)));
}

/** 오늘 몇 번째 추가 구매의 값. 한도를 넘으면 undefined다. */
export function duelExtraAttemptPrice(purchasedToday: number): number | undefined {
  return DUEL_EXTRA_ATTEMPT_PRICES[purchasedToday];
}

/** 새로고침 한 번의 젬 값. 무료 횟수가 남았으면 0이다. */
export function duelRefreshPrice(refreshesUsed: number): number {
  if (refreshesUsed < DUEL_FREE_REFRESHES) return 0;
  return DUEL_REFRESH_PRICES[Math.min(refreshesUsed - DUEL_FREE_REFRESHES, DUEL_REFRESH_PRICES.length - 1)];
}

/** 오늘 남은 무료 새로고침. */
export function duelFreeRefreshesLeft(refreshesUsed: number): number {
  return Math.max(0, DUEL_FREE_REFRESHES - refreshesUsed);
}

/** 세워 둔 상대 모두와 싸웠는가 — 그러면 새 상대가 선다. */
export function duelAllOpponentsFought(candidateIds: readonly string[], foughtIds: readonly string[]): boolean {
  return candidateIds.length > 0 && candidateIds.every((id) => foughtIds.includes(id));
}

/** 티어(디비전이 아니라 브론즈·실버 같은 큰 칸)가 올랐는가 — 그러면 새 티어에 맞는 상대가 선다. */
export function duelTierRose(scoreBefore: number, scoreAfter: number): boolean {
  return duelTierIndex(scoreAfter) > duelTierIndex(scoreBefore);
}

/** UTC 날짜 키. 도전권·새로고침이 이 키로 하루를 가른다. */
export function duelDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** 시즌 번호(1부터). 기준점 이전은 1로 수렴한다. */
export function duelSeasonNumber(now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - DUEL_SEASON_EPOCH) / (DUEL_SEASON_DAYS * DAY_MS)) + 1);
}

export function duelSeasonId(now: Date): string {
  return `S${duelSeasonNumber(now)}`;
}

/** 이 시즌이 끝나는 시각. */
export function duelSeasonEndsAt(now: Date): Date {
  return new Date(DUEL_SEASON_EPOCH + duelSeasonNumber(now) * DUEL_SEASON_DAYS * DAY_MS);
}

/**
 * 시즌이 넘어갈 때의 점수 — 지난 점수의 60%를 단계 경계로 내려 맞춘다.
 *
 * 0으로 되돌리면 상위권이 첫 주 내내 브론즈를 쓸고 다니고, 그대로 두면 새 시즌이 아무 의미가
 * 없다. 절반 남짓을 남겨 다시 오르는 길이 짧게 열린다.
 */
export function duelSeasonResetScore(score: number): number {
  return Math.floor((score * 0.6) / DUEL_DIVISION_SPAN) * DUEL_DIVISION_SPAN;
}

/** 점수 오름 사이에 새로 닿은 티어들(처음 닿을 때의 젬을 셈한다). 이미 닿았던 티어는 뺀다. */
export function duelNewlyReachedTiers(before: number, after: number, reached: readonly string[]): DuelTierDef[] {
  const from = duelTierIndex(before); const to = duelTierIndex(after);
  return DUEL_TIERS.slice(from + 1, to + 1).filter((tier) => !reached.includes(tier.id) && tier.firstReachGems > 0);
}

/**
 * 상대 후보 다섯 — **훨씬 낮음·낮음·비슷함·높음·훨씬 높음**.
 *
 * 다섯이 모두 비슷하면 고를 이유가 없고, 무작위면 매번 가장 약한 쪽만 누른다. 아래로는 쉬운
 * 판(덜 오른다), 위로는 어려운 판(더 오른다)이 늘 둘씩 선다. 칸이 비면 남은 중 가장 가까운 쪽으로 채운다.
 */
export function pickDuelOpponents<T extends { id: string; score: number }>(pool: readonly T[], myScore: number, random: () => number, exclude: readonly string[] = []): T[] {
  const candidates = pool.filter(({ id }) => !exclude.includes(id));
  const bands: Array<[number, number]> = [[-420, -160], [-200, -40], [-60, 60], [40, 200], [160, 440]];
  const picked: T[] = [];
  for (const [low, high] of bands) {
    const inBand = candidates.filter((entry) => !picked.includes(entry) && entry.score - myScore >= low && entry.score - myScore <= high);
    if (inBand.length > 0) picked.push(inBand[Math.floor(random() * inBand.length) % inBand.length]);
  }
  const rest = candidates
    .filter((entry) => !picked.includes(entry))
    .sort((a, b) => Math.abs(a.score - myScore) - Math.abs(b.score - myScore));
  while (picked.length < DUEL_OPPONENT_COUNT && rest.length > 0) picked.push(rest.shift()!);
  return picked.sort((a, b) => a.score - b.score);
}

/**
 * 방어덱 한 칸의 능력치 — 레벨·돌파까지만 자란 값(룬 없음).
 *
 * 표본 상대(실제 이용자 풀이 생기기 전)를 세울 때 쓴다. 이용자가 올린 방어덱은 올린 순간 서버가
 * 굳힌 최종 능력치(룬 포함)를 그대로 쓴다.
 */
export function duelGrownStats(def: Pick<RelicDef, "stats" | "rarity">, level: number, breakthrough: number): Stats {
  return applyBreakthrough(applyLevelGrowth(def.stats, level, def.rarity), breakthrough);
}

/** 점수대가 세우는 표본 상대의 레벨. 브론즈 바닥이 10, 챌린저 위쪽이 60이다. */
export function duelNpcLevel(score: number): number {
  return clamp(Math.round(10 + (score / 3_000) * 50), 8, 60);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
