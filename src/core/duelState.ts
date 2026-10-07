import {
  DUEL_DAILY_ATTEMPTS, DUEL_OPPONENT_COUNT, DUEL_START_SCORE, DUEL_TIERS, duelDayKey, duelSeasonId, duelSeasonResetScore, duelTier, getDuelTier, type DuelTierId,
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
  /**
   * 상대의 얼굴·티어·덱 — 전적 탭이 줄마다 세운다. 이 칸이 생기기 전의 기록에는 없으므로 없으면 그 자리를
   * 비워 두고 선다(저장 마이그레이션 없음). 싸운 뒤의 기록이라 가렸던 칸도 드러난 채로 남는다.
   */
  opponentTierId?: DuelTierId;
  opponentFavoriteRelicId?: string;
  opponentUnits?: DuelHistoryUnit[];
}

export interface DuelHistoryUnit { relicId: string; level: number; }

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
  /** 광고로 오늘 더 받은 도전권. 젬 구매(`attemptsPurchased`)와 따로 세야 다음 구매 값이 광고에 밀려 오르지 않는다. */
  attemptsFromAds: number;
  refreshesUsed: number;
  /** 지금 세워 둔 상대 후보(NPC ID, `DUEL_OPPONENT_COUNT`명). */
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
  /** 지금 이어지는 연승. 지면 0, 시즌이 넘어가도 0이다. 이긴 판의 연승 보너스(`duelStreakBonus`)가 이 수를 읽는다. */
  winStreak: number;
  /** 이번 시즌 가장 길었던 연승. */
  bestStreak: number;
  /** 이번 시즌 닿았던 가장 높은 점수 — 「이번 시즌 최고 티어」가 이 점수의 티어다. */
  seasonBestScore: number;
  /** 지난 시즌을 마친 티어. 지난 시즌에 한 판도 치르지 않았으면 없다. */
  lastSeasonTierId: DuelTierId | null;
}

export const DUEL_HISTORY_LIMIT = 10;

export function createEmptyDuelState(): DuelState {
  return {
    seasonId: "", score: DUEL_START_SCORE, wins: 0, losses: 0, reachedTierIds: [],
    dayKey: "", attemptsUsed: 0, attemptsPurchased: 0, attemptsFromAds: 0, refreshesUsed: 0, candidateIds: [],
    attack: [], defense: [], blindChoice: [], pendingSeasonReward: null, history: [],
    winStreak: 0, bestStreak: 0, seasonBestScore: DUEL_START_SCORE, lastSeasonTierId: null,
  };
}

export function cloneDuelState(state: DuelState): DuelState {
  return {
    ...state, reachedTierIds: [...state.reachedTierIds], candidateIds: [...state.candidateIds],
    attack: [...state.attack], defense: [...state.defense], blindChoice: [...state.blindChoice],
    pendingSeasonReward: state.pendingSeasonReward ? { ...state.pendingSeasonReward } : null,
    history: state.history.map((entry) => ({ ...entry, ...(entry.opponentUnits ? { opponentUnits: entry.opponentUnits.map((unit) => ({ ...unit })) } : {}) })),
  };
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const stringList = (value: unknown, limit: number): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, limit) : [];

/**
 * 저장에서 읽은 값을 받아들일 수 있는 모양으로 좁힌다. 결투장 도입(v47) 전 저장은 빈 상태로
 * 시작한다 — 잃을 기록이 없다. 보유하지 않은 렐릭은 편성에서 걷는다.
 */
/** 전적 한 줄의 덧붙은 칸(티어·얼굴·덱)은 읽을 수 있을 때만 남긴다 — 옛 기록은 그 칸 없이 선다. */
function normalizeHistoryEntry(entry: DuelHistoryEntry): DuelHistoryEntry {
  const { opponentTierId, opponentFavoriteRelicId, opponentUnits, ...base } = entry;
  const units = Array.isArray(opponentUnits)
    ? opponentUnits.filter((unit): unit is DuelHistoryUnit => !!unit && typeof unit.relicId === "string" && isCount(unit.level)).slice(0, 3).map(({ relicId, level }) => ({ relicId, level }))
    : [];
  return {
    ...base,
    ...(typeof opponentTierId === "string" && getDuelTier(opponentTierId) ? { opponentTierId } : {}),
    ...(typeof opponentFavoriteRelicId === "string" ? { opponentFavoriteRelicId } : {}),
    ...(units.length > 0 ? { opponentUnits: units } : {}),
  };
}

export function normalizeDuelState(value: unknown, ownedRelicIds: readonly string[]): DuelState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof DuelState, unknown>>;
  const owned = new Set(ownedRelicIds);
  const team = (list: unknown): string[] => stringList(list, 3).filter((id) => owned.has(id));
  const reward = source.pendingSeasonReward as Partial<DuelSeasonRewardPending> | null | undefined;
  const history = Array.isArray(source.history) ? source.history.filter((entry): entry is DuelHistoryEntry =>
    !!entry && typeof entry.at === "string" && typeof entry.opponentName === "string" && Number.isSafeInteger(entry.opponentScore)
    && typeof entry.won === "boolean" && Number.isSafeInteger(entry.delta)).slice(0, DUEL_HISTORY_LIMIT).map(normalizeHistoryEntry) : [];
  const defense = team(source.defense);
  const score = isCount(source.score) ? source.score : DUEL_START_SCORE;
  return {
    seasonId: typeof source.seasonId === "string" ? source.seasonId : "",
    score,
    wins: isCount(source.wins) ? source.wins : 0,
    losses: isCount(source.losses) ? source.losses : 0,
    reachedTierIds: stringList(source.reachedTierIds, DUEL_TIERS.length).filter((id): id is DuelTierId => getDuelTier(id) !== undefined),
    dayKey: typeof source.dayKey === "string" ? source.dayKey : "",
    attemptsUsed: isCount(source.attemptsUsed) ? source.attemptsUsed : 0,
    attemptsPurchased: isCount(source.attemptsPurchased) ? source.attemptsPurchased : 0,
    attemptsFromAds: isCount(source.attemptsFromAds) ? source.attemptsFromAds : 0,
    refreshesUsed: isCount(source.refreshesUsed) ? source.refreshesUsed : 0,
    candidateIds: stringList(source.candidateIds, DUEL_OPPONENT_COUNT),
    attack: team(source.attack),
    defense,
    blindChoice: stringList(source.blindChoice, 2).filter((id) => defense.includes(id)),
    pendingSeasonReward: reward && typeof reward.seasonId === "string" && reward.tierId && getDuelTier(reward.tierId)
      ? { seasonId: reward.seasonId, tierId: reward.tierId } : null,
    history,
    winStreak: isCount(source.winStreak) ? source.winStreak : 0,
    bestStreak: isCount(source.bestStreak) ? source.bestStreak : 0,
    // 이 칸이 생기기 전의 저장은 지금 점수가 곧 이번 시즌 최고다.
    seasonBestScore: isCount(source.seasonBestScore) ? Math.max(source.seasonBestScore, score) : score,
    lastSeasonTierId: typeof source.lastSeasonTierId === "string" && getDuelTier(source.lastSeasonTierId) ? source.lastSeasonTierId as DuelTierId : null,
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
    // 처음 여는 계정(빈 시즌)은 지난 시즌이 없다. 판을 치르지 않고 넘어간 시즌도 남기지 않는다.
    if (next.seasonId !== "") next.lastSeasonTierId = played ? duelTier(next.score).id : null;
    next.score = next.seasonId === "" ? next.score : duelSeasonResetScore(next.score);
    next.reachedTierIds = DUEL_TIERS.filter(({ floor }) => floor <= next.score).map(({ id }) => id);
    next.wins = 0;
    next.losses = 0;
    next.winStreak = 0;
    next.bestStreak = 0;
    next.seasonBestScore = next.score;
    next.candidateIds = [];
    next.seasonId = seasonId;
  }
  const dayKey = duelDayKey(now);
  if (next.dayKey !== dayKey) {
    next.dayKey = dayKey;
    next.attemptsUsed = 0;
    next.attemptsPurchased = 0;
    next.attemptsFromAds = 0;
    next.refreshesUsed = 0;
  }
  return next;
}

/**
 * 오늘 남은 도전권. 하루 기본 몫에 젬으로 산 몫과 광고로 받은 몫을 더하고 쓴 만큼 뺀다.
 * 서버(입장·상태)와 상단 줄이 같은 함수를 읽는다 — 한쪽만 광고 몫을 빼먹으면 「0/5」인데 입장이 되는 일이 생긴다.
 */
export function duelAttemptsLeft(state: Pick<DuelState, "attemptsUsed" | "attemptsPurchased" | "attemptsFromAds">): number {
  return Math.max(0, DUEL_DAILY_ATTEMPTS + state.attemptsPurchased + state.attemptsFromAds - state.attemptsUsed);
}

/**
 * 전적 한 줄의 「얼마 전」. 1분 안이면 `now`, 그 뒤로는 분 → 시간 → 일 중 가장 큰 단위 하나만 쓴다.
 * 읽을 수 없는 시각이나 미래 시각(기기 시계가 뒤로 간 경우)은 `now`로 수렴한다.
 */
export function duelHistoryAge(at: string, nowMs: number): { unit: "now" | "minute" | "hour" | "day"; value: number } {
  const elapsed = nowMs - Date.parse(at);
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return { unit: "now", value: 0 };
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return { unit: "minute", value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hour", value: hours };
  return { unit: "day", value: Math.floor(hours / 24) };
}
