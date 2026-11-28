import { activeBreakthroughOf } from "../core/relicProgression";
import { t } from "../i18n";
import { competitiveMonthlyOn } from '../core/competitiveSeason';
import { arenaRules, RANKED_ARENA_RULES, startArena, applyArenaAction, settleArena, publicArenaRoom, type ArenaRoom, type ArenaAction, type ArenaPlayer } from '../core/liveArena';
import { arenaSetup, ARENA_SLOTS } from '../core/liveArena';
import { saveManager } from '../state/SaveManager';
import { RelicProgressionManager } from '../managers/RelicProgressionManager';
import { getRelic } from '../data/relics';
import { partyRuneTraitEffects } from '../core/runeTraitEffects';
/**
 * 아레나 RPC 이름 — 월간 시즌(`competitiveMonthlyOn`)은 마이그레이션 20261204000000의 v2를 부른다. 모양은 같고
 * 순위·자리가 그 달 판을 읽으며(`weekEndsAt`은 달 마감, `lastWeek`는 지난달), 판정 전에 달을 넘긴다(RP 절반 남김).
 */
const arenaRpcNames = () => competitiveMonthlyOn()
  ? { standing: 'server_arena_standing_v2', ranking: 'server_arena_ranking_v2', commit: 'server_arena_commit_v2' }
  : { standing: 'server_arena_standing', ranking: 'server_arena_ranking', commit: 'server_arena_commit' };
/** `server_arena_standing` — 화면이 읽는 내 자리. */
export interface ArenaStanding { score:number; wins:number; losses:number; winStreak:number; bestStreak:number; bestScore:number; nextStreakBonus:number; rank:number|null; weekEndsAt:string; serverTime:string; lastWeek:{score:number;rank:number|null}|null }
export interface ArenaContext { playerId:string; score:number; wins:number; losses:number; queuedAt?:string; room:ArenaRoom|null; incoming:ArenaRoom[]; receiptFingerprint?:unknown; records:{id:string;data:unknown}[] }
export type ArenaRpc=(name:string,args:Record<string,unknown>)=>Promise<unknown>;
export function arenaPlayer(id:string,data:unknown):ArenaPlayer {
  const s=saveManager.parse(data), progression=new RelicProgressionManager(s);
  return { id, name:s.playerCard.nickname || t("profile.defaultName"), roster:[...s.owned].map(relicId=>({
    def:{...getRelic(relicId),stats:progression.getFinalStats(relicId, { pvp: true })},level:s.relicProgress[relicId]?.level??1,
    breakthrough:activeBreakthroughOf(s.relicProgress[relicId]),bond:s.relicProgress[relicId]?.bondLevel??0,
    traits:partyRuneTraitEffects([{relicId,runes:(s.relicProgress[relicId]?.heartGemSlots??[]).flatMap(key=>s.runeInventory.filter(r=>r.instanceId===key))}]),
  })) };
}
type ArenaSaveState=ReturnType<typeof saveManager.parse>;
const fieldable=(state:ArenaSaveState,id:unknown):id is string=>typeof id==='string' && state.owned.has(id) && !getRelic(id).summonOnly;

/** 비동기 친선전에서 친구가 세우는 편 — 결투장 방어덱(비었으면 지금 편성)에서 보유한 셋까지. 미리보기와 전투가 같은 값을 읽는다. */
export function practiceDefenseIds(state:ArenaSaveState):string[] {
  const defense=(state.duel?.defense??[]).filter(id=>fieldable(state,id));
  return [...new Set(defense.length>0?defense:state.party.filter(id=>fieldable(state,id)))].slice(0,3);
}

/** 친선전의 내 편 — 편성 화면이 보낸 셋을 믿지 않고 보유·중복·소환 전용을 다시 가린다. 쓸 수 없으면 지금 편성이다. */
export function practicePartyIds(state:ArenaSaveState,requested:unknown):string[] {
  if(Array.isArray(requested) && requested.length>=1 && requested.length<=3 && new Set(requested).size===requested.length && requested.every(id=>fieldable(state,id))) return requested as string[];
  return [...new Set(state.party.filter(id=>fieldable(state,id)))].slice(0,3);
}

/** 친선전 미리보기에 서는 친구의 편 — 렐릭·레벨·돌파·대인전 전투력. 친구가 아니면 거절한다. */
export async function arenaPracticePreview(rpc:ArenaRpc,player:string,target:unknown):Promise<{units:{relicId:string;level:number;breakthrough:number;power:number}[];totalPower:number}> {
  if(typeof target!=='string' || target===player || !(await rpc('server_are_friends',{p_a:player,p_b:target}))) throw Error('ARENA_FRIEND_REQUIRED');
  const saved=await rpc('server_load_state',{p_player:target}) as {data?:unknown}|null;
  if(!saved?.data) throw Error('ARENA_FRIEND_REQUIRED');
  const state=saveManager.parse(saved.data), progression=new RelicProgressionManager(state);
  const units=practiceDefenseIds(state).map(relicId=>({relicId,level:state.relicProgress[relicId]?.level??1,breakthrough:activeBreakthroughOf(state.relicProgress[relicId]),power:progression.getCombatPower(relicId,{pvp:true})}));
  return {units,totalPower:units.reduce((sum,u)=>sum+u.power,0)};
}

export async function handleArenaCall(rpc:ArenaRpc, player:string, method:string, args:unknown[], requestId?:string):Promise<unknown> {
  const input=(args[0]??{}) as {kind?:string;roomId?:string;target?:string;rules?:unknown;action?:ArenaAction;party?:unknown};
  // 읽기만 하는 두 갈래(내 자리·주간 순위)는 방 잠금·정리를 거치지 않는다 — 로비 프로필도 이 값을 읽는다.
  if(method==='get' && input.kind==='standing') return await rpc(arenaRpcNames().standing,{p_player:player});
  if(method==='get' && input.kind==='ranking') return await rpc(arenaRpcNames().ranking,{p_player:player,p_limit:100});
  if(method==='get' && input.kind==='practicePreview') return await arenaPracticePreview(rpc,player,input.target);
  const kind=method==='get'?'status':input.kind;
  if(!['status','queue','cancel','invite','accept','decline','practice','action','finish'].includes(kind??'')) throw Error('ARENA_ACTION');
  let rules=input.rules===undefined?RANKED_ARENA_RULES:arenaRules(input.rules);
  if(kind==='queue') rules=RANKED_ARENA_RULES;
  let context=await (kind==='status'
    ? rpc('server_arena_status',{p_player:player,p_room:input.roomId??null})
    : rpc('server_arena_context',{p_player:player,p_kind:kind,p_room:input.roomId??null,p_target:input.target??null,p_rules:rules,p_request:requestId??null})) as ArenaContext;
  let room=context.room;
  const fingerprint={call:JSON.stringify([method,args])};
  const applied=context.receiptFingerprint!==null && context.receiptFingerprint!==undefined;
  if(applied && (context.receiptFingerprint as {call?:string}).call!==fingerprint.call) throw Error('ARENA_REQUEST_CONFLICT');
  if(!applied && room && !['done','declined'].includes(room.phase)) {
    for(let retry=0;retry<3;retry++) {
      let next=room;
      if(room.phase!=='invited' && !room.players[0]?.roster) next=startArena(room,room.players.map(p=>arenaPlayer(p.id,context.records.find(s=>s.id===p.id)!.data)),Date.now());
      if ((next as ArenaRoom & {practice?:boolean}).practice && !next.lease) {
        next.players.forEach((p,side)=>{
          const state=saveManager.parse(context.records.find(s=>s.id===p.id)!.data);
          // 신청한 쪽(0)은 편성 화면이 고른 셋, 받는 쪽(1)은 결투장 방어덱이다.
          const ids=side===0?practicePartyIds(state,kind==='practice'&&p.id===player?input.party:undefined):practiceDefenseIds(state);
          next.picks[side]=ids.slice(0,3).map((relicId,slot)=>({relicId,slot,...ARENA_SLOTS[slot]}));
        });
        next.locked=[true,true];next.phase='battle';next.deadline=Date.now()+600000;
        next.lease={id:next.id,seed:next.seed,setup:arenaSetup(next),expiresAt:new Date(next.deadline).toISOString()};
      }
      if(kind==='action' && (!input.action || typeof input.action.kind!=='string')) throw Error('ARENA_ACTION');
      next=applyArenaAction(next,player,kind==='action'?input.action!:{kind:'tick'},Date.now());
      if(kind==='finish' || (next.phase==='battle' && Date.now()>=next.deadline)) next=settleArena(next);
      if(JSON.stringify(next)===JSON.stringify(room)) break;
      const out=await rpc(arenaRpcNames().commit,{p_player:player,p_room:room.id,p_version:room.version,p_data:next,p_request:(kind==='action'||kind==='finish')?requestId??null:null,p_fingerprint:fingerprint}) as {conflict?:boolean;room:ArenaRoom};
      room=out.room;
      if(!out.conflict) break;
      if(retry===2) throw Error('ARENA_CONFLICT');
    }
  }
  // Privacy is enforced before the HTTP boundary, even for cached/finished reads.
  // 끝난 판은 정산 뒤의 RP·연승을, 입구 조회는 연승·주간 순위까지 함께 돌려준다.
  if(room?.phase==='done' || kind==='status') {
    const standing=await rpc(arenaRpcNames().standing,{p_player:player}) as ArenaStanding;
    context={...context,...standing};
  }
  delete context.receiptFingerprint;
  context={...context,room:room?publicArenaRoom(room,player):null,records:[]};
  return context;
}
