import { t } from "../i18n";
import { arenaRules, RANKED_ARENA_RULES, startArena, applyArenaAction, settleArena, publicArenaRoom, type ArenaRoom, type ArenaAction, type ArenaPlayer } from '../core/liveArena';
import { arenaSetup } from '../core/liveArena';
import { saveManager } from '../state/SaveManager';
import { RelicProgressionManager } from '../managers/RelicProgressionManager';
import { getRelic } from '../data/relics';
import { partyRuneTraitEffects } from '../core/runeTraitEffects';
export interface ArenaContext { playerId:string; score:number; wins:number; losses:number; queuedAt?:string; room:ArenaRoom|null; incoming:ArenaRoom[]; receiptFingerprint?:unknown; records:{id:string;data:unknown}[] }
export type ArenaRpc=(name:string,args:Record<string,unknown>)=>Promise<unknown>;
export function arenaPlayer(id:string,data:unknown):ArenaPlayer {
  const s=saveManager.parse(data), progression=new RelicProgressionManager(s);
  return { id, name:s.playerCard.nickname || t("profile.defaultName"), roster:[...s.owned].map(relicId=>({
    def:{...getRelic(relicId),stats:progression.getFinalStats(relicId)},level:s.relicProgress[relicId]?.level??1,
    breakthrough:s.relicProgress[relicId]?.breakthrough??0,bond:s.relicProgress[relicId]?.bondLevel??0,
    traits:partyRuneTraitEffects([{relicId,runes:(s.relicProgress[relicId]?.heartGemSlots??[]).flatMap(key=>s.runeInventory.filter(r=>r.instanceId===key))}]),
  })) };
}
export async function handleArenaCall(rpc:ArenaRpc, player:string, method:string, args:unknown[], requestId?:string):Promise<unknown> {
  const input=(args[0]??{}) as {kind?:string;roomId?:string;target?:string;rules?:unknown;action?:ArenaAction};
  const kind=method==='get'?'status':input.kind;
  if(!['status','queue','cancel','invite','accept','decline','practice','action','finish'].includes(kind??'')) throw Error('ARENA_ACTION');
  let rules=input.rules===undefined?RANKED_ARENA_RULES:arenaRules(input.rules);
  if(kind==='queue') rules=RANKED_ARENA_RULES;
  let context=await rpc('server_arena_context',{p_player:player,p_kind:kind,p_room:input.roomId??null,p_target:input.target??null,p_rules:rules,p_request:requestId??null}) as ArenaContext;
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
          const ids=side===0?state.party:state.duel?.defense??state.party;
          next.picks[side]=ids.slice(0,3).map((relicId,i)=>({relicId,x:[0.08,0.5,0.92][i],y:i===1?0.32:0}));
        });
        next.locked=[true,true];next.phase='battle';next.deadline=Date.now()+600000;
        next.lease={id:next.id,seed:next.seed,setup:arenaSetup(next),expiresAt:new Date(next.deadline).toISOString()};
      }
      if(kind==='action' && (!input.action || typeof input.action.kind!=='string')) throw Error('ARENA_ACTION');
      next=applyArenaAction(next,player,kind==='action'?input.action!:{kind:'tick'},Date.now());
      if(kind==='finish' || (next.phase==='battle' && Date.now()>=next.deadline)) next=settleArena(next);
      if(JSON.stringify(next)===JSON.stringify(room)) break;
      const out=await rpc('server_arena_commit',{p_player:player,p_room:room.id,p_version:room.version,p_data:next,p_request:(kind==='action'||kind==='finish')?requestId??null:null,p_fingerprint:fingerprint}) as {conflict?:boolean;room:ArenaRoom};
      room=out.room;
      if(!out.conflict) break;
      if(retry===2) throw Error('ARENA_CONFLICT');
    }
  }
  // Privacy is enforced before the HTTP boundary, even for cached/finished reads.
  if(room?.phase==='done') {
    const latest=await rpc('server_arena_context',{p_player:player,p_kind:'status',p_room:room.id,p_target:null,p_rules:RANKED_ARENA_RULES,p_request:null}) as ArenaContext;
    context={...context,score:latest.score,wins:latest.wins,losses:latest.losses};
  }
  delete context.receiptFingerprint;
  context={...context,room:room?publicArenaRoom(room,player):null,records:[]};
  return context;
}
