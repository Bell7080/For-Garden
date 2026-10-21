import { describe, it, expect } from 'vitest';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { handleGameCall, type StateStore } from '../../src/server/gameHandler';
import type { ServerGameMethod } from '../../src/server/gameMethods';
import { combatState, type CombatLease } from '../../src/core/combatProtocol';
import { bossBattleRandom } from '../../src/core/bossSimulation';
import { canFireUltimate, fireUltimate, stepSkirmish } from '../../src/core/skirmish';

describe('치즈케이크 원격 저장 왕복', () => {
 it.each(['cake-1','cake-8'])('%s 입장·전투·결과·재조회', async tierId => {
  const state=createDefaultSession(); state.wallet.stamina=300; state.cakeOperation.clearedIndex=7;
  state.party=['rex','mette','torika'];
  for(const id of state.party){state.owned.add(id);state.relicProgress[id]={...createInitialRelicProgress(),level:60,breakthrough:4};}
  let stored={data:JSON.parse(JSON.stringify(saveManager.exportData(state))),revision:'1'};
  const receipts=new Map<string,unknown>();let now=new Date('2026-10-21T23:59:00Z');
  const store:StateStore={load:async()=>structuredClone(stored),findReceipt:async(_,id)=>receipts.get(id),commit:async input=>{
   saveManager.parse(input.data);const revision=String(Number(stored.revision)+1);
   stored={data:JSON.parse(JSON.stringify(input.data)),revision};if(input.requestId)receipts.set(input.requestId,{...(input.response as object),revision});return {revision};
  }};
  let request=0;
  const call=async(method:ServerGameMethod,args:unknown[]=[])=>handleGameCall('player',{method,args,requestId:`request-${++request}`},{store,strict:true,now:()=>now});
  const admission=`admission-${tierId}`;
  await call('enterCakeOperation',[{tierId,requestId:admission}]);
  const lease=(await call('prepareCombat',[{input:{mode:'cake',tierId,requestId:admission},stageId:'1-1'}])).result as CombatLease;
  const fight=combatState(lease),random=bossBattleRandom(lease.seed),actions=[];let ticks=0;
  while(fight.phase==='fight'&&ticks<18000){
   for(const actor of fight.fighters.filter(f=>f.side==='player'&&f.summonOwnerId===null))if(canFireUltimate(fight,actor)){fireUltimate(fight,actor.id,random);actions.push({tick:ticks,actorId:actor.id});}
   if(fight.phase!=='fight')break;stepSkirmish(fight,.02,random);ticks++;
  }
  now=new Date(now.getTime()+600000);
  await call('finishCombat',[{id:lease.id,ticks,actions}]);
  const result=await call('completeCakeOperation',[{tierId,requestId:admission,victory:true}]);
  expect(result.ok).toBe(true);await call('getPlayerState');
 });
});
