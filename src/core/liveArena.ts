/** Server-owned live preparation. No clocks, sessions or network dependencies. */
import type { CombatLease, CombatSetup } from './combatProtocol';
import { combatState, COMBAT_STEP_MS, MAX_COMBAT_TICKS } from './combatProtocol';
import { stepSkirmish } from './skirmish';
import { bossBattleRandom } from './bossSimulation';
import { battleArena } from './battleArena';
import type { RelicDef } from './types';
import type { ExpeditionAugmentEffect } from './expeditionAugments';

export interface ArenaRules { ban: boolean; order: 'first' | 'second' | 'random'; placement: 'alternate' | 'hidden' }
export const RANKED_ARENA_RULES: ArenaRules = { ban: true, order: 'random', placement: 'alternate' };
export interface ArenaUnit { def: RelicDef; level: number; breakthrough: number; bond: number; traits: ExpeditionAugmentEffect[] }
export interface ArenaPlayer { id: string; name: string; roster: ArenaUnit[] }
export interface ArenaPlacement { relicId: string; x: number; y: number }
export interface ArenaRoom {
  id: string; version: number; ranked: boolean; rules: ArenaRules; players: ArenaPlayer[];
  phase: 'invited' | 'ban' | 'place' | 'battle' | 'done' | 'declined';
  first: number; bans: (string | null)[]; picks: ArenaPlacement[][]; locked: boolean[];
  deadline: number; seed: string; winner?: number | null; reason?: 'combat' | 'timeout' | 'forfeit';
  lease?: CombatLease; resultTicks?: number;
}
export type ArenaAction = { kind: 'ban'; relicId: string } | { kind: 'place'; relicId: string; x: number; y: number }
  | { kind: 'undo' } | { kind: 'lock' } | { kind: 'forfeit' } | { kind: 'tick' };
export function arenaRules(value: unknown): ArenaRules {
  const r = value as ArenaRules;
  if (!r || typeof r.ban !== 'boolean' || !['first','second','random'].includes(r.order) || !['alternate','hidden'].includes(r.placement)) throw Error('ARENA_RULES');
  return { ban: r.ban, order: r.order, placement: r.placement };
}
export const ARENA_TIERS = [
  { name: 'bronze', score: 0 }, { name: 'silver', score: 1100 }, { name: 'gold', score: 1300 },
  { name: 'platinum', score: 1500 }, { name: 'diamond', score: 1800 }, { name: 'master', score: 2100 },
] as const;
export function arenaTier(score: number): (typeof ARENA_TIERS)[number]["name"] { return [...ARENA_TIERS].reverse().find(t => score >= t.score)?.name ?? 'bronze'; }
export function arenaTurn(room: ArenaRoom): number {
  if (room.phase === 'ban') return room.bans[room.first] === null ? room.first : 1 - room.first;
  const total = room.picks[0].length + room.picks[1].length;
  return (room.first + total) % 2;
}
export function startArena(room: ArenaRoom, players: ArenaPlayer[], now: number): ArenaRoom {
  if (players.length !== 2 || players.some(p => p.roster.length < (room.rules.ban ? 4 : 3))) throw Error('ARENA_ROSTER');
  return { ...room, players, phase: room.rules.ban ? 'ban' : 'place', bans: [null,null], picks: [[],[]], locked: [false,false], deadline: now + 45000 };
}
/** Coordinates are relative to each team's own half; both teams receive the same placement area. */
export function arenaPosition(p: ArenaPlacement, side: number): { x: number; y: number } {
  const a = battleArena('duel');
  return { x: a.left + 35 + p.x * (a.right - a.left - 70), y: side === 0 ? a.bottom - 30 - p.y * 215 : a.top + 30 + p.y * 215 };
}
export function arenaSetup(room: ArenaRoom): CombatSetup {
  const selected = room.picks.map((picks, side) => picks.map(p => room.players[side].roster.find(u => u.def.id === p.relicId)!));
  const [a,b] = selected;
  return { players: a.map(u => u.def), enemies: b.map(u => u.def), arena: battleArena('duel'),
    bonds: Object.fromEntries(a.map(u => [u.def.id,u.bond])), breakthroughs: Object.fromEntries(a.map(u => [u.def.id,u.breakthrough])),
    options: { automaticUltimates: true, playerPositions: room.picks[0].map(p => arenaPosition(p,0)), enemyPositions: room.picks[1].map(p => arenaPosition(p,1)),
      augmentEffects: a.flatMap(u => u.traits), enemyAugmentEffects: b.flatMap(u => u.traits), enemyBondLevels: b.map(u => u.bond), enemyBreakthroughs: b.map(u => u.breakthrough), enemyBodyScale: 1 } };
}
export function applyArenaAction(source: ArenaRoom, actor: string, action: ArenaAction, now: number): ArenaRoom {
  const r = structuredClone(source), side = r.players.findIndex(p => p.id === actor);
  if (side < 0) throw Error('ARENA_FORBIDDEN');
  if (['done','declined'].includes(r.phase)) return r;
  if(r.phase==='invited') { if(action.kind==='forfeit' && side===0) {r.phase='declined';return r;} return r; }
  if (action.kind === 'forfeit') { r.phase='done'; r.winner=1-side; r.reason='forfeit'; return r; }
  if (now >= r.deadline && r.phase !== 'battle') {
    const late = r.phase === 'place' && r.rules.placement === 'hidden' ? r.locked.findIndex(v => !v) : arenaTurn(r);
    r.phase='done'; r.winner=r.rules.placement === 'hidden' && !r.locked[0] && !r.locked[1] && source.phase === 'place' ? null : 1-late;
    r.reason='timeout'; return r;
  }
  if (action.kind === 'tick') return r;
  if (r.phase === 'ban') {
    if (action.kind !== 'ban' || arenaTurn(r) !== side || r.bans[side] !== null || !r.players[1-side].roster.some(u => u.def.id === action.relicId)) throw Error('ARENA_TURN');
    r.bans[side]=action.relicId;
    if (r.bans.every(Boolean)) r.phase='place';
    r.deadline=now+45000; return r;
  }
  if (r.phase !== 'place' || r.locked[side]) throw Error('ARENA_PHASE');
  const alternate=r.rules.placement === 'alternate';
  if (alternate && arenaTurn(r) !== side) throw Error('ARENA_TURN');
  if (action.kind === 'undo' && !alternate) r.picks[side].pop();
  else if (action.kind === 'lock' && !alternate && r.picks[side].length === 3) r.locked[side]=true;
  else if (action.kind === 'place') {
    const p: ArenaPlacement={ relicId: action.relicId, x: action.x, y: action.y };
    if (r.picks[side].length >= 3 || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.x>1 || p.y<0 || p.y>1
      || !r.players[side].roster.some(u => u.def.id === p.relicId) || r.bans[1-side] === p.relicId || r.picks[side].some(q => q.relicId === p.relicId || Math.hypot((q.x-p.x)*750,(q.y-p.y)*215)<80)) throw Error('ARENA_PLACEMENT');
    r.picks[side].push(p);
    if (alternate) { r.locked[side]=r.picks[side].length===3; r.deadline=now+45000; }
  } else throw Error('ARENA_ACTION');
  if (r.locked.every(Boolean)) {
    r.phase='battle'; r.deadline=now+600000;
    r.lease={ id:r.id, seed:r.seed, setup:arenaSetup(r), expiresAt:new Date(r.deadline).toISOString() };
  }
  return r;
}
/** Same canonical orientation and seed for both clients, including defender. Never accept a client winner. */
export function settleArena(room: ArenaRoom): ArenaRoom {
  if (room.phase !== 'battle' || !room.lease) return room;
  const state=combatState(room.lease), random=bossBattleRandom(room.seed);
  let ticks=0;
  while(state.phase === 'fight' && ticks<MAX_COMBAT_TICKS) { stepSkirmish(state,COMBAT_STEP_MS/1000,random); ticks++; }
  return { ...room, phase:'done', winner:state.phase === 'victory' ? 0 : state.phase === 'defeat' ? 1 : null, reason:'combat', resultTicks:ticks };
}
export function publicArenaRoom(room: ArenaRoom, actor: string): ArenaRoom {
  const r=structuredClone(room), side=r.players.findIndex(p => p.id===actor);
  if(side<0) throw Error('ARENA_FORBIDDEN');
  if(r.rules.placement==='hidden' && (r.phase==='place' || r.phase==='ban')) { r.picks[1-side]=[]; delete r.lease; }
  return r;
}
