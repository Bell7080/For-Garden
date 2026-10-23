/** Server-owned live preparation. No clocks, sessions or network dependencies. */
import type { CombatLease, CombatSetup } from './combatProtocol';
import { combatState, COMBAT_STEP_MS, MAX_COMBAT_TICKS } from './combatProtocol';
import { stepSkirmish } from './skirmish';
import { bossBattleRandom } from './bossSimulation';
import { battleArena } from './battleArena';
import type { RelicDef } from './types';
import type { ExpeditionAugmentEffect } from './expeditionAugments';

/**
 * `unique`는 교차 공개 배치에서 **상대가 이미 고른 렐릭을 고르지 못하게** 한다(기본 켜짐 — 저장된 옛 방은 키가 없어 켜진 것으로 읽는다).
 * 친선전만 끌 수 있다. 비공개 배치는 상대 선택을 모르므로 이 규칙이 서지 않는다.
 */
export interface ArenaRules { ban: boolean; order: 'first' | 'second' | 'random'; placement: 'alternate' | 'hidden'; unique?: boolean }
export const RANKED_ARENA_RULES: ArenaRules = { ban: true, order: 'random', placement: 'alternate', unique: true };
export interface ArenaUnit { def: RelicDef; level: number; breakthrough: number; bond: number; traits: ExpeditionAugmentEffect[] }
export interface ArenaPlayer { id: string; name: string; roster: ArenaUnit[] }
/** 배치는 좌표가 아니라 1·2·3번 칸이다. 좌표는 칸에서 나오고 전투 코어가 그대로 읽는다. */
export interface ArenaPlacement { relicId: string; x: number; y: number; slot?: number }
/** 칸마다 서는 자리(자기 진영 기준). 가운데(2번)는 스토리 편성처럼 한 걸음 앞으로 나선다. */
export const ARENA_SLOTS: readonly { x: number; y: number }[] = [{ x: 0.08, y: 0 }, { x: 0.5, y: 0.32 }, { x: 0.92, y: 0 }];
/** 밴을 확정했지만 아직 서로 공개되지 않은 자리. 공개 방(`publicArenaRoom`)만 이 값을 쓴다. */
export const ARENA_HIDDEN_BAN = '?';
export interface ArenaRoom {
  id: string; version: number; ranked: boolean; rules: ArenaRules; players: ArenaPlayer[];
  phase: 'invited' | 'ban' | 'place' | 'battle' | 'done' | 'declined';
  first: number; bans: (string | null)[]; picks: ArenaPlacement[][]; locked: boolean[];
  deadline: number; seed: string; winner?: number | null; reason?: 'combat' | 'timeout' | 'forfeit';
  lease?: CombatLease; resultTicks?: number;
}
export type ArenaAction = { kind: 'ban'; relicId: string } | { kind: 'place'; relicId: string; slot: number }
  | { kind: 'undo' } | { kind: 'lock' } | { kind: 'forfeit' } | { kind: 'tick' };
export function arenaRules(value: unknown): ArenaRules {
  const r = value as ArenaRules;
  if (!r || typeof r.ban !== 'boolean' || !['first','second','random'].includes(r.order) || !['alternate','hidden'].includes(r.placement) || (r.unique !== undefined && typeof r.unique !== 'boolean')) throw Error('ARENA_RULES');
  return { ban: r.ban, order: r.order, placement: r.placement, unique: r.unique !== false };
}
export const ARENA_TIERS = [
  { name: 'bronze', score: 0 }, { name: 'silver', score: 1100 }, { name: 'gold', score: 1300 },
  { name: 'platinum', score: 1500 }, { name: 'diamond', score: 1800 }, { name: 'master', score: 2100 },
] as const;
export function arenaTier(score: number): (typeof ARENA_TIERS)[number]["name"] { return [...ARENA_TIERS].reverse().find(t => score >= t.score)?.name ?? 'bronze'; }
/** 상대가 이미 고른 렐릭을 막는가. 비공개 배치는 상대 선택을 모르므로 막지 않는다. */
export function arenaUniquePicks(rules: ArenaRules): boolean { return rules.unique !== false && rules.placement === 'alternate'; }
/**
 * 차례. 밴은 **동시에 비공개로** 고른다 — 아직 밴하지 않은 쪽(둘 다면 선공)이 돌아온다.
 * 밴 차례를 묻는 화면은 이것이 아니라 `arenaCanAct`를 읽는다.
 */
export function arenaTurn(room: ArenaRoom): number {
  if (room.phase === 'ban') return room.bans[room.first] === null ? room.first : 1 - room.first;
  const total = room.picks[0].length + room.picks[1].length;
  return (room.first + total) % 2;
}
/** 그 편이 지금 손을 쓸 수 있는가(밴은 동시, 비공개 배치는 확정 전까지). */
export function arenaCanAct(room: ArenaRoom, side: number): boolean {
  if (room.phase === 'ban') return room.bans[side] === null;
  if (room.phase !== 'place' || room.locked[side]) return false;
  return room.rules.placement === 'hidden' || arenaTurn(room) === side;
}
/**
 * 그 편이 지금 고를 수 있는 렐릭. 밴은 **양쪽 모두에게서** 빠지고, 중복 금지면 상대가 고른 렐릭도 빠진다.
 * 다 빠져 고를 것이 없으면 중복 금지 → 밴 순서로 풀어 준다 — 보유가 적은 편이 고를 것이 없어 시간 초과로 지는 판을 막는다.
 */
export function arenaPickable(room: ArenaRoom, side: number): ArenaUnit[] {
  const own = room.players[side].roster.filter(u => !room.picks[side].some(p => p.relicId === u.def.id));
  const open = own.filter(u => !room.bans.includes(u.def.id));
  const pool = open.length ? open : own;
  if (!arenaUniquePicks(room.rules)) return pool;
  const unique = pool.filter(u => !room.picks[1 - side].some(p => p.relicId === u.def.id));
  return unique.length ? unique : pool;
}
export function startArena(room: ArenaRoom, players: ArenaPlayer[], now: number): ArenaRoom {
  if (players.length !== 2 || players.some(p => p.roster.length < (room.rules.ban ? 4 : 3))) throw Error('ARENA_ROSTER');
  return { ...room, players, phase: room.rules.ban ? 'ban' : 'place', bans: [null,null], picks: [[],[]], locked: [false,false], deadline: now + 45000 };
}
/** Coordinates are relative to each team's own half; both teams receive the same placement area. */
export function arenaPosition(p: ArenaPlacement, side: number): { x: number; y: number } {
  const a = battleArena('liveArena');
  return { x: a.left + 35 + p.x * (a.right - a.left - 70), y: side === 0 ? a.bottom - p.y * 215 : a.top + p.y * 215 };
}
export function arenaSetup(room: ArenaRoom): CombatSetup {
  const selected = room.picks.map((picks, side) => picks.map(p => room.players[side].roster.find(u => u.def.id === p.relicId)!));
  const [a,b] = selected;
  return { players: a.map(u => u.def), enemies: b.map(u => u.def), arena: battleArena('liveArena'),
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
    // 동시에 고르는 단계(밴·비공개 배치)는 둘 다 늦으면 무승부, 한쪽만 늦으면 그쪽의 패배다.
    const simultaneous = r.phase === 'ban' || r.rules.placement === 'hidden';
    const waiting = r.phase === 'ban' ? r.bans.map(b => b === null) : r.locked.map(v => !v);
    const late = simultaneous ? waiting.indexOf(true) : arenaTurn(r);
    r.phase='done'; r.winner=simultaneous && waiting[0] && waiting[1] ? null : 1-late;
    r.reason='timeout'; return r;
  }
  if (action.kind === 'tick') return r;
  if (r.phase === 'ban') {
    if (action.kind !== 'ban' || r.bans[side] !== null) throw Error('ARENA_TURN');
    if (typeof action.relicId !== 'string' || !r.players[1-side].roster.some(u => u.def.id === action.relicId)) throw Error('ARENA_PLACEMENT');
    r.bans[side]=action.relicId;
    // 둘 다 밴을 확정한 순간에만 다음 단계로 넘어가고 시계를 새로 건다 — 먼저 고른 쪽이 상대 시간을 줄이지 않는다.
    if (r.bans.every(b => b !== null)) { r.phase='place'; r.deadline=now+45000; }
    return r;
  }
  if (r.phase !== 'place' || r.locked[side]) throw Error('ARENA_PHASE');
  const alternate=r.rules.placement === 'alternate';
  if (alternate && arenaTurn(r) !== side) throw Error('ARENA_TURN');
  if (action.kind === 'undo' && !alternate) r.picks[side].pop();
  else if (action.kind === 'lock' && !alternate && r.picks[side].length === 3) r.locked[side]=true;
  else if (action.kind === 'place') {
    const slot = action.slot;
    if (r.picks[side].length >= 3 || !Number.isInteger(slot) || slot < 0 || slot >= ARENA_SLOTS.length || r.picks[side].some(q => q.slot === slot)
      || !arenaPickable(r, side).some(u => u.def.id === action.relicId)) throw Error('ARENA_PLACEMENT');
    r.picks[side].push({ relicId: action.relicId, slot, ...ARENA_SLOTS[slot] });
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
  // 밴은 둘 다 확정할 때까지 상대가 무엇을 골랐는지 숨긴다. 골랐다는 사실만 남긴다.
  if(r.phase==='ban' && r.bans[1-side] !== null) r.bans[1-side]=ARENA_HIDDEN_BAN;
  if(r.rules.placement==='hidden' && (r.phase==='place' || r.phase==='ban')) { r.picks[1-side]=[]; delete r.lease; }
  return r;
}
