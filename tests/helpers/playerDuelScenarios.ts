import assert from 'node:assert/strict';
import { handleGameCall, StateConflictError } from '../../src/server/gameHandler';
import { createSupabaseStore } from '../../src/server/supabaseStore';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { normalizePlayerLevel } from '../../src/core/playerLevel';
import { combatState } from '../../src/core/combatProtocol';
import { bossBattleRandom } from '../../src/core/bossSimulation';
import { stepSkirmish, canFireUltimate, fireUltimate } from '../../src/core/skirmish';
import { WEEKLY_RANK_GEMS } from '../../src/data/competitiveRewards';
import { duelSeasonId, duelSeasonResetScore, DUEL_TIERS } from '../../src/core/duelArena';
import { expeditionWeekKey } from '../../src/core/expeditionBoss';
export async function run(sql: (s: string) => string) {
 const q=(v: unknown)=>v===null?'null':`'${String(typeof v==='string'?v:JSON.stringify(v)).replaceAll("'","''")}'`;
 const ids=Array.from({length:5},(_,i)=>`00000000-0000-0000-0000-${String(i+101).padStart(12,'0')}`);
 let now=new Date(); let seq=0;
 const store=createSupabaseStore({url:'https://isolated.invalid',serviceKey:'isolated-test-only',fetchImpl:async(url,init)=>{
   const method=String(url).split('/').at(-1)!;const args=JSON.parse(String(init?.body));
   try{return new Response(sql(`select public.${method}(${Object.entries(args).map(([k,v])=>`${k} => ${q(v)}`).join(',')});`)||'null');}
   catch(error){if(String(error).includes('conflict'))return new Response('{"message":"save_conflict"}',{status:409});throw error;}
 }});
 const call=(id:string,method:string,args:unknown[]=[],requestId?:string)=>handleGameCall(id,{method,args,requestId:method.startsWith('get')?undefined:requestId??`pvp-test-${++seq}`},{store,strict:true,now:()=>now,random:()=>.25});
 for(let i=0;i<ids.length;i++){
   sql(`insert into auth.users(id,is_anonymous) values('${ids[i]}',true);`);
   const s=createDefaultSession();s.playerResearch=normalizePlayerLevel({level:i===3?5:6});s.playerCard.nickname=`guest-${i}`;s.wallet.gems=10000;
   if(i===0)for(const id of s.party)s.relicProgress[id]={...createInitialRelicProgress(),level:30,breakthrough:2};
   // 一度もPvP画面へ入らずに保存された基本防衛編成。
   const data=saveManager.exportData(s);await store.commit({playerId:ids[i],expectedRevision:null,data,method:'fixture',requestId:null,response:{}});
 }
 sql(`update public.players set status='banned' where id='${ids[4]}';`);
 const status:any=(await call(ids[0],'getDuelStatus')).result;
 assert.equal(status.opponents.length,2);assert.deepEqual(new Set(status.opponents.map((r:any)=>r.id)),new Set(ids.slice(1,3)));
 assert(status.opponents.every((r:any)=>r.score===0));assert(status.opponents.every((r:any)=>r.units.map((u:any)=>u.relicId).join(',')==='parua,torika,dodo'));
 assert(!JSON.stringify(status).includes('runeInventory'));assert(!JSON.stringify(status).includes('wallet'));
 const ranking:any=(await call(ids[0],'getDuelRanking')).result;assert.equal(ranking.entries.length,3);assert.equal(ranking.me.rank,1);
 await assert.rejects(call(ids[3],'getDuelStatus'),(e:any)=>e.code==='content_locked');
 assert.equal(((await call(ids[0],'refreshDuelOpponents')).result as any).opponents.length,2,'small roster refresh must retain available opponents');
 const ticketStatus:any=(await call(ids[0],'getDuelStatus')).result;
 const beforeTicket=saveManager.parse((await store.load(ids[0]))!.data).wallet.gems;
 const bought:any=(await call(ids[0],'buyDuelAttempt',[],'buy-ticket-once')).result;
 assert.equal(bought.attemptsLeft,ticketStatus.attemptsLeft+1);assert.equal(saveManager.parse((await store.load(ids[0]))!.data).wallet.gems,beforeTicket-50);
 await call(ids[0],'buyDuelAttempt',[],'buy-ticket-once');assert.equal(saveManager.parse((await store.load(ids[0]))!.data).wallet.gems,beforeTicket-50);
 await call(ids[1],'setDuelDefense',[{relicIds:['dodo','parua','torika'],blindChoice:['dodo']}]);
 const next:any=(await call(ids[0],'getDuelStatus')).result;assert.deepEqual(next.opponents.find((r:any)=>r.id===ids[1]).units.map((u:any)=>u.relicId),['dodo','parua','torika']);
 await assert.rejects(call(ids[0],'enterDuel',[{requestId:'self-admission',opponentId:ids[0],relicIds:['parua','torika','dodo']}]),/./);
 const entryId='actual-duel-admission';
 const admitted:any=(await call(ids[0],'enterDuel',[{requestId:entryId,opponentId:ids[1],relicIds:['parua','torika','dodo']}],'duel-entry-once')).result;
 const retried:any=(await call(ids[0],'enterDuel',[{requestId:entryId,opponentId:ids[1],relicIds:['parua','torika','dodo']}],'duel-entry-once')).result;
 assert.deepEqual(admitted,retried);
 await assert.rejects(call(ids[0],'resolveDuel',[{requestId:entryId,won:true}]),/COMBAT_NOT_VERIFIED/);
 const input={mode:'duel',requestId:entryId,attack:['rex'],opponentName:'forged',opponentScore:9999,units:[]};
 const lease:any=(await call(ids[0],'prepareCombat',[{input,automaticUltimates:true}])).result;
 assert.equal(lease.setup.options.automaticUltimates,true);
 assert.deepEqual(lease.setup.players.map((r:any)=>r.id),['parua','torika','dodo']);assert.equal(lease.setup.enemies.length,3);
 const battle=combatState(lease),random=bossBattleRandom(lease.seed),actions:any[]=[];let ticks=0;
 while(battle.phase==='fight'&&ticks<18000){stepSkirmish(battle,.02,random);ticks++;if(!battle.automaticUltimates)for(const f of battle.fighters.filter(f=>f.side==='player'&&f.summonOwnerId===null))if(canFireUltimate(battle,f)){fireUltimate(battle,f.id,random);actions.push({tick:ticks,actorId:f.id});}}
 now=new Date(now.getTime()+ticks*20);
 const verdict:any=(await call(ids[0],'finishCombat',[{id:lease.id,ticks,actions}])).result;assert.equal(verdict.victory,battle.phase==='victory');
 const resolved:any=(await call(ids[0],'resolveDuel',[{requestId:entryId,won:!verdict.victory}],'duel-resolve-once')).result;
 assert.equal(resolved.won,verdict.victory,'client victory claim must be ignored');
 const after=saveManager.parse((await store.load(ids[0]))!.data);const defense=saveManager.parse((await store.load(ids[1]))!.data);
 assert.equal(resolved.scoreAfter,after.duel!.score);if(verdict.victory)assert(after.duel!.score>0,'a real victory must add PvP points');
 assert.equal(after.duel!.attemptsUsed,1);assert.equal(defense.duel!.history[0].side,'defense');assert.equal(defense.duel!.history[0].won,!verdict.victory);
 const revision=(await store.load(ids[1]))!.revision;
 await call(ids[0],'resolveDuel',[{requestId:entryId,won:!verdict.victory}],'duel-resolve-once');assert.equal((await store.load(ids[1]))!.revision,revision,'retry must not apply defense twice');
 await assert.rejects(call(ids[0],'resolveDuel',[{requestId:entryId,won:true}]),/COMBAT_NOT_VERIFIED/);
 // 双方の保存を原子的に扱い、防衛側の同時変更は攻撃者の保存も取り消す。
 const before=await store.load(ids[0]);
 await assert.rejects(store.commit({playerId:ids[0],expectedRevision:before!.revision,data:before!.data,method:'resolveDuel',requestId:'conflict-atomic',response:{},duels:[{playerId:ids[1],expectedRevision:'0',duel:defense.duel!,gems:100}]}),StateConflictError);
 assert.equal((await store.load(ids[0]))!.revision,before!.revision);
 // 本物の保存で原征の週次順位を投影する。
 const week=expeditionWeekKey(new Date());
 for(let i=0;i<2;i++){const saved=(await store.load(ids[i]))!;const s=saveManager.parse(saved.data);s.expedition.weekKey=week;s.expedition.bestScore=1000;s.expedition.bestAchievedAt=new Date(Date.now()+i*1000).toISOString();await store.commit({playerId:ids[i],expectedRevision:saved.revision,data:saveManager.exportData(s),method:'fixture',requestId:null,response:{}});}
 const board:any=(await call(ids[0],'getExpeditionLeaderboard',[100])).result;assert.equal(board.entries.length,2);assert.equal(board.entries[0].playerId,ids[0]);
 const best:any=(await call(ids[0],'getExpeditionWeeklyBest')).result;assert.equal(best.rank,1);assert.equal(best.rankRewards.gems,5000);
 // 閉じた週を用意して同時/反復配送・未参加除外・通常メール受取を確認。
 const old=sql("select ((date_trunc('week',now() at time zone 'UTC'))::date-7)::text;");
 sql(`insert into public.server_competitive_scores values('duel',${q(old)},'${ids[0]}',500,now()-interval '8 days',true),('duel',${q(old)},'${ids[1]}',400,now()-interval '8 days',true),('duel',${q(old)},'${ids[2]}',0,now()-interval '8 days',false),('expedition',${q(old)},'${ids[0]}',1000,now()-interval '8 days',true);`);
 await store.opsInbox!(ids[0]);await store.opsInbox!(ids[0]);await store.opsInbox!(ids[1]);await store.opsInbox!(ids[2]);
 assert.equal(sql(`select count(*) from public.server_competitive_awards where player_id='${ids[0]}';`),'2');
 assert.equal(sql(`select gems from public.server_competitive_awards where player_id='${ids[1]}' and board='duel';`),'4000');
 assert.equal(sql(`select count(*) from public.server_competitive_awards where player_id='${ids[2]}';`),'0');
 const mails:any=(await call(ids[0],'getMails')).result;const mailIds=mails.mails.filter((m:any)=>m.id.startsWith('ops:')).map((m:any)=>m.id);
 assert.equal(mailIds.length,2);
 const salvageBefore=saveManager.parse((await store.load(ids[0]))!.data).wallet.salvageRecord;
 const gemsBefore=saveManager.parse((await store.load(ids[0]))!.data).wallet.gems;
 await call(ids[0],'claimMailRewards',[{mailIds,requestId:'claim-weekly-both'}],'claim-weekly-once');
 assert.equal(saveManager.parse((await store.load(ids[0]))!.data).wallet.gems,gemsBefore+10000);
 assert.equal(saveManager.parse((await store.load(ids[0]))!.data).wallet.salvageRecord,salvageBefore+400);
 await call(ids[0],'claimMailRewards',[{mailIds,requestId:'claim-weekly-both'}],'claim-weekly-once');assert.equal(saveManager.parse((await store.load(ids[0]))!.data).wallet.gems,gemsBefore+10000);
 // 3주 시즌 종료 후 점수 소프트 초기화와 티어 보상은 각각 한 번만 반영한다.
 const saved=(await store.load(ids[0]))!;const seasonal=saveManager.parse(saved.data);
 seasonal.duel!.seasonId=duelSeasonId(now);seasonal.duel!.score=1200;seasonal.duel!.seasonBestScore=1200;seasonal.duel!.wins=1;
 await store.commit({playerId:ids[0],expectedRevision:saved.revision,data:saveManager.exportData(seasonal),method:'fixture',requestId:null,response:{}});
 now=new Date(now.getTime()+21*86400000);
 const seasonStatus:any=(await call(ids[0],'getDuelStatus')).result;
 assert.equal(seasonStatus.score,duelSeasonResetScore(1200));assert.equal(seasonStatus.pendingSeasonReward.gems,3000);
 const seasonGems=saveManager.parse((await store.load(ids[0]))!.data).wallet.gems;
 await call(ids[0],'claimDuelSeasonReward',[],'season-claim-once');await call(ids[0],'claimDuelSeasonReward',[],'season-claim-once');
 assert.equal(saveManager.parse((await store.load(ids[0]))!.data).wallet.gems,seasonGems+3000);
 assert.equal(sql("select has_function_privilege('authenticated','public.server_duel_context(uuid,text,integer)','execute');"),'f');
 assert.equal(sql("select has_table_privilege('authenticated','public.server_competitive_scores','select');"),'f');
 console.log(JSON.stringify({guestsAtZero:true,autoDefense:true,realBattle:ticks,serverVerdict:verdict.victory,atomicDefense:true,retrySafe:true,expeditionRanking:true,weeklyGems:WEEKLY_RANK_GEMS,seasonDays:21,platinumGems:DUEL_TIERS[3].seasonReward.gems}));
}
