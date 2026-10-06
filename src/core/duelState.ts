import {
  DUEL_START_SCORE, DUEL_TIERS, duelDayKey, duelSeasonId, duelSeasonResetScore, duelTier, getDuelTier, type DuelTierId,
} from "./duelArena";

/**
 * 결투장의 **저장 모양**과 기간 넘김.
 *
 * 점수·도전권·편성·전적이 한 덩어리로 저장에 남는다. 상대 후보는 NPC ID만 남기고 그 편성은
 * 시즌 시드에서 다시 세운다(`duelNpcPool`) — 상대의 능력치까지 저장하면 데이터를 고친 뒤에도
 * 옛 수치가 남는다. 실제 서버로 옮기면 상대는 다른 사람의 방어덱 스냅샷이 된다.
 */

/** 한 판의 기록. 결투장 화면의 전적 목록이 그대로 그린다. */
export interface DuelHistoryEntry {
  at: string;
  opponentName: string;
  opponentScore: number;
  won: boolean;
  /** 이 판으로 바뀐 내 점수(보호로 깎인 몫을 뺀 실제 값). */
  delta: number;
}

/** 끝난 시즌의 정산 대기. 결투장 화면이 받기를 세운다. */
export interface DuelSeasonRewardPending {
  seasonId: string;
  tierId: DuelTierId;
}

export interface DuelState {
  /** 이 기록이 속한 시즌. 빈 값은 아직 한 번도 열지 않은 계정이다. */
  seasonId: string;
  score: number;
  wins: number;
  losses: number;
  /** 이번 시즌에 처음 닿아 젬을 받은 티어. */
  reachedTierIds: DuelTierId[];
  /** 도전권·새로고침이 묶이는 UTC 날짜. */
  dayKey: string;
  attemptsUsed: number;
  attemptsPurchased: number;
  refreshesUsed: number;
  /** 지금 세워 둔 상대 후보 셋(NPC ID). */
  candidateIds: string[];
  /** 마지막으로 싸운 공격덱. 다음 편성의 시작값이다. */
  attack: string[];
  /** 게시한 방어덱. 비어 있으면 아직 세우지 않았다. */
  defense: string[];
  /** 방어덱에서 먼저 가릴 렐릭. 비어 있으면 전투력 순으로 저절로 가린다. */
  blindChoice: string[];
  pendingSeasonReward: DuelSeasonRewardPending | null;
  /** 최근 판부터. 길이는 `DUEL_HISTORY_LIMIT`까지. */
  history: DuelHistoryEntry[];
}

export const DUEL_HISTORY_LIMIT = 10;

export function createEmptyDuelState(): DuelState {
  return {
    seasonId: "", score: DUEL_START_SCORE, wins: 0, losses: 0, reachedTierIds: [],
    dayKey: "", attemptsUsed: 0, attemptsPurchased: 0, refreshesUsed: 0, candidateIds: [],
    attack: [], defense: [], blindChoice: [], pendingSeasonReward: null, history: [],
  };
}

export function cloneDuelState(state: DuelState): DuelState {
  return {
    ...state, reachedTierIds: [...state.reachedTierIds], candidateIds: [...state.candidateIds],
    attack: [...state.attack], defense: [...state.defense], blindChoice: [...state.blindChoice],
    pendingSeasonReward: state.pendingSeasonReward ? { ...state.pendingSeasonReward } : null,
    history: state.history.map((entry) => ({ ...entry })),
  };
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const stringList = (value: unknown, limit: number): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, limit) : [];

/**
 * 저장에서 읽은 값을 받아들일 수 있는 모양으로 좁힌다. 결투장 도입(v47) 전 저장은 빈 상태로
 * 시작한다 — 잃을 기록이 없다. 보유하지 않은 렐릭은 편성에서 걷는다.
 */
export function normalizeDuelState(value: unknown, ownedRelicIds: readonly string[]): DuelState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof DuelState, unknown>>;
  const owned = new Set(ownedRelicIds);
  const team = (list: unknown): string[] => stringList(list, 3).filter((id) => owned.has(id));
  const reward = source.pendingSeasonReward as Partial<DuelSeasonRewardPending> | null | undefined;
  const history = Array.isArray(source.history) ? source.history.filter((entry): entry is DuelHistoryEntry =>
    !!entry && typeof entry.at === "string" && typeof entry.opponentName === "string" && Number.isSafeInteger(entry.opponentScore)
    && typeof entry.won === "boolean" && Number.isSafeInteger(entry.delta)).slice(0, DUEL_HISTORY_LIMIT).map((entry) => ({ ...entry })) : [];
  const defense = team(source.defense);
  return {
    seasonId: typeof source.seasonId === "string" ? source.seasonId : "",
    score: isCount(source.score) ? source.score : DUEL_START_SCORE,
    wins: isCount(source.wins) ? source.wins : 0,
    losses: isCount(source.losses) ? source.losses : 0,
    reachedTierIds: stringList(source.reachedTierIds, DUEL_TIERS.length).filter((id): id is DuelTierId => getDuelTier(id) !== undefined),
    dayKey: typeof source.dayKey === "string" ? source.dayKey : "",
    attemptsUsed: isCount(source.attemptsUsed) ? source.attemptsUsed : 0,
    attemptsPurchased: isCount(source.attemptsPurchased) ? source.attemptsPurchased : 0,
    refreshesUsed: isCount(source.refreshesUsed) ? source.refreshesUsed : 0,
    candidateIds: stringList(source.candidateIds, 3),
    attack: team(source.attack),
    defense,
    blindChoice: stringList(source.blindChoice, 2).filter((id) => defense.includes(id)),
    pendingSeasonReward: reward && typeof reward.seasonId === "string" && reward.tierId && getDuelTier(reward.tierId)
      ? { seasonId: reward.seasonId, tierId: reward.tierId } : null,
    history,
  };
}

/** 저장 검증 — `normalizeDuelState`를 지나도 그대로인 값만 받아들인다. */
export function isValidDuelState(value: unknown, ownedRelicIds: readonly string[]): boolean {
  if (!value || typeof value !== "object") return false;
  return JSON.stringify(normalizeDuelState(value, ownedRelicIds)) === JSON.stringify(value);
}

/**
 * 날짜·시즌을 지금으로 넘긴다. **화면과 서버가 같은 함수를 지난다** — 한쪽만 넘기면 도전권이나
 * 시즌 보상이 갈린다.
 *
 * 시즌이 바뀌면 끝난 시즌의 티어를 정산 대기로 옮기고, 점수를 내린 뒤 그 점수까지의 티어는 이미
 * 닿은 것으로 둔다 — 리셋된 자리를 다시 지나며 첫 도달 젬을 받지 않게 한다.
 */
export function rollDuelPeriods(state: DuelState, now: Date): DuelState {
  const next = cloneDuelState(state);
  const seasonId = duelSeasonId(now);
  if (next.seasonId !== seasonId) {
    const played = next.seasonId !== "" && next.wins + next.losses > 0;
    if (played) next.pendingSeasonReward = { seasonId: next.seasonId, tierId: duelTier(next.score).id };
    next.score = next.seasonId === "" ? next.score : duelSeasonResetScore(next.score);
    next.reachedTierIds = DUEL_TIERS.filter(({ floor }) => floor <= next.score).map(({ id }) => id);
    next.wins = 0;
    next.losses = 0;
    next.candidateIds = [];
    next.seasonId = seasonId;
  }
  const dayKey = duelDayKey(now);
  if (next.dayKey !== dayKey) {
    next.dayKey = dayKey;
    next.attemptsUsed = 0;
    next.attemptsPurchased = 0;
    next.refreshesUsed = 0;
  }
  return next;
}
