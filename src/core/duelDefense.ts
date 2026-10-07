import { applyDuelScore, DUEL_DEFENSE_SIM, duelDefenseWinChance, duelNewlyReachedTiers, duelStanding, pickDuelOpponents, type DuelTierDef } from "./duelArena";
import type { DuelNpc } from "./duelNpcPool";
import { cloneDuelState, DUEL_HISTORY_LIMIT, type DuelHistoryEntry, type DuelState } from "./duelState";

/**
 * 방어전 — 표본 상대가 내 방어덱을 친 판을 시간에 맞춰 굴린다(규칙 값은 `DUEL_DEFENSE_SIM`).
 *
 * 순수 함수라 난수를 인자로 받는다. 서버(`FakeServer.duelNow`)가 결투장 상태를 읽을 때마다 지나며, 실제 서버로
 * 옮기면 이 자리가 다른 사람의 실제 공격 기록으로 바뀐다. 점수가 오르면 처음 닿은 티어를 함께 돌려주어 그 첫
 * 도달 젬이 공격 판에 밀려 사라지지 않게 한다.
 */
export interface DuelDefenseResult {
  state: DuelState;
  entries: DuelHistoryEntry[];
  reachedTiers: DuelTierDef[];
}

const HOUR_MS = 3_600_000;

export function simulateDuelDefenses(
  state: DuelState, now: Date, pool: readonly DuelNpc[], defensePower: number, random: () => number,
): DuelDefenseResult {
  const nowMs = now.getTime();
  const simMs = Date.parse(state.defenseSimAt);
  // 시계가 아직 없거나 기기 시계가 뒤로 갔으면 지금으로 세우기만 한다.
  if (!Number.isFinite(simMs) || simMs > nowMs) {
    const next = cloneDuelState(state);
    next.defenseSimAt = now.toISOString();
    return { state: next, entries: [], reachedTiers: [] };
  }
  const interval = DUEL_DEFENSE_SIM.intervalHours * HOUR_MS;
  const due = Math.floor((nowMs - simMs) / interval);
  if (due <= 0 || state.defense.length === 0 || pool.length === 0) return { state, entries: [], reachedTiers: [] };

  const next = cloneDuelState(state);
  const count = Math.min(due, DUEL_DEFENSE_SIM.catchUpLimit);
  // 쌓인 판은 가장 최근 몫만 남긴다 — 오래 비운 동안의 판을 한꺼번에 몰아 치르지 않는다.
  const firstMs = simMs + (due - count + 1) * interval;
  const entries: DuelHistoryEntry[] = [];
  const reachedTiers: DuelTierDef[] = [];
  for (let index = 0; index < count; index += 1) {
    const candidates = pickDuelOpponents(pool, next.score, random);
    const npc = candidates[Math.floor(random() * candidates.length)] ?? pool[0];
    const theirs = npc.units.reduce((sum, unit) => sum + unit.power, 0);
    const won = random() < duelDefenseWinChance(defensePower, theirs);
    const before = next.score;
    const after = applyDuelScore(before, won ? DUEL_DEFENSE_SIM.win : -DUEL_DEFENSE_SIM.loss);
    const reached = won ? duelNewlyReachedTiers(before, after, next.reachedTierIds) : [];
    next.score = after;
    next.seasonBestScore = Math.max(next.seasonBestScore, after);
    next.reachedTierIds = [...next.reachedTierIds, ...reached.map(({ id }) => id)];
    reachedTiers.push(...reached);
    entries.push({
      at: new Date(firstMs + index * interval).toISOString(), opponentName: npc.displayName, opponentScore: npc.score, won, delta: after - before,
      opponentTierId: duelStanding(npc.score).tier.id, opponentFavoriteRelicId: npc.favoriteRelicId,
      opponentUnits: npc.units.map(({ relicId, level }) => ({ relicId, level })), side: "defense",
    });
  }
  next.defenseSimAt = new Date(simMs + due * interval).toISOString();
  next.history = [...[...entries].reverse(), ...next.history].slice(0, DUEL_HISTORY_LIMIT);
  return { state: next, entries, reachedTiers };
}
