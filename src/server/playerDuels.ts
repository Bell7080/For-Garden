import { combatPower } from '../core/combatPower';
import { battleArena } from '../core/battleArena';
import type { CombatSetup } from '../core/combatProtocol';
import { applyDuelScore, DUEL_DEFENSE_SIM, duelNewlyReachedTiers, duelStanding, duelBlindOrder } from '../core/duelArena';
import { DUEL_HISTORY_LIMIT, normalizeDuelState, rollDuelPeriods, type DuelState } from '../core/duelState';
import { partyRuneTraitEffects } from '../core/runeTraitEffects';
import type { DuelNpc } from '../core/duelNpcPool';
import { getRelic } from '../data/relics';
import { RelicProgressionManager } from '../managers/RelicProgressionManager';
import { createDefaultSession, type Session } from '../state/session';
import { saveManager } from '../state/SaveManager';
import { t } from '../i18n';
import { profileFace } from '../state/playerProfile';

export interface PlayerDuelRecord { id: string; revision: string; data: Record<string, unknown> }
export interface PlayerDuelContext {
  playerId: string;
  records: PlayerDuelRecord[];
  rank: number;
  ranking: { id: string; displayName: string; score: number; favoriteRelicId: string; avatarRelicId?: string | null; frameId?: string | null }[];
  changes: PlayerDuelChange[];
}
export interface PlayerDuelChange { playerId: string; expectedRevision: string; duel: DuelState; gems: number }

/** DB는 인증된 활성 계정의 저장에서만 이 비공개 투영을 만든다. 클라이언트로 원본을 보내지 않는다. */
export function duelParticipant(row: PlayerDuelRecord, now: Date): { state: Session; opponent: DuelNpc } {
  const base = saveManager.exportData(createDefaultSession());
  const owned = row.data.ownedRelicIds as string[];
  const state = saveManager.parse({ ...base, ...row.data, party: owned.slice(0, 3), favorite: owned.includes(String(row.data.favorite)) ? row.data.favorite : owned[0] });
  state.duel = rollDuelPeriods(normalizeDuelState(state.duel, owned), now);
  const progression = new RelicProgressionManager(state);
  const units = state.duel.defense.map(relicId => {
    const stats = progression.getFinalStats(relicId), progress = state.relicProgress[relicId];
    return { relicId, level: progress?.level ?? 1, breakthrough: progress?.breakthrough ?? 0, stats, power: combatPower(stats) };
  });
  return { state, opponent: { id: row.id, displayName: state.playerCard.nickname || t('profile.defaultName'), score: state.duel.score, favoriteRelicId: state.favorite, ...profileFace(state), units, blindOrder: duelBlindOrder(units, state.duel.blindChoice) } };
}

/** 입장 순간 양쪽의 실제 성장·룬·유대를 고정한다. 이후 덱 수정으로 진행 중인 판을 바꾸지 않는다. */
export function duelCombatSetup(state: Session, opponentState: Session, attack: readonly string[]): CombatSetup {
  const progression = new RelicProgressionManager(state), defenseProgression = new RelicProgressionManager(opponentState);
  const defense = opponentState.duel!.defense;
  const traits = (s: Session, ids: readonly string[]) => partyRuneTraitEffects(ids.map(relicId => ({ relicId, runes: (s.relicProgress[relicId]?.heartGemSlots ?? []).flatMap(id => s.runeInventory.filter(r => r.instanceId === id)) })));
  return {
    players: attack.map(id => ({ ...getRelic(id), stats: progression.getFinalStats(id) })),
    enemies: defense.map(id => ({ ...getRelic(id), stats: defenseProgression.getFinalStats(id) })),
    arena: battleArena('duel'),
    bonds: Object.fromEntries(attack.map(id => [id, state.relicProgress[id]?.bondLevel ?? 0])),
    breakthroughs: Object.fromEntries(attack.map(id => [id, state.relicProgress[id]?.breakthrough ?? 0])),
    options: { automaticUltimates: true, augmentEffects: traits(state, attack), enemyAugmentEffects: traits(opponentState, defense), enemyBondLevels: defense.map(id => opponentState.relicProgress[id]?.bondLevel ?? 0), enemyBreakthroughs: defense.map(id => opponentState.relicProgress[id]?.breakthrough ?? 0), enemyBodyScale: 1 },
  };
}

/** 실제로 끝난 공격만 방어 기록을 만든다. 보상·점수와 공격자의 영수증은 DB에서 같이 확정한다. */
export function recordPlayerDefense(context: PlayerDuelContext, opponentId: string, attacker: Session, attack: readonly string[], attackerWon: boolean, now: Date): void {
  const row = context.records.find(r => r.id === opponentId);
  if (!row) throw new Error('DUEL_OPPONENT_NOT_FOUND');
  const { state } = duelParticipant(row, now), duel = state.duel!;
  const before = duel.score, won = !attackerWon;
  duel.score = applyDuelScore(before, won ? DUEL_DEFENSE_SIM.win : -DUEL_DEFENSE_SIM.loss);
  const reached = duelNewlyReachedTiers(before, duel.score, duel.reachedTierIds);
  duel.reachedTierIds.push(...reached.map(t => t.id));
  duel.seasonBestScore = Math.max(duel.seasonBestScore, duel.score);
  // 승/패 합계는 시즌 참가 여부도 결정한다. 방어 승리는 공격 연승/도전권을 바꾸지 않는다.
  duel.wins += won ? 1 : 0; duel.losses += won ? 0 : 1;
  duel.history = [{ at: now.toISOString(), opponentName: attacker.playerCard.nickname || t('profile.defaultName'), opponentScore: attacker.duel!.score, won, delta: duel.score - before, opponentTierId: duelStanding(attacker.duel!.score).tier.id, opponentFavoriteRelicId: attacker.favorite, opponentUnits: attack.map(relicId => ({ relicId, level: attacker.relicProgress[relicId]?.level ?? 1 })), side: 'defense' as const }, ...duel.history].slice(0, DUEL_HISTORY_LIMIT);
  context.changes.push({ playerId: row.id, expectedRevision: row.revision, duel, gems: reached.reduce((n, t) => n + t.firstReachGems, 0) });
}
