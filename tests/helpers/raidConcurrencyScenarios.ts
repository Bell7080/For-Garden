/** 실제 PostgreSQL RPC + strict handler + RemoteGameApi를 통과하는 다계정 레이드 경계 검사. */
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../../src/server/supabaseStore';
import { handleGameCall, GameCallError, type StateStore } from '../../src/server/gameHandler';
import { createRemoteGameApi } from '../../src/api/RemoteGameApi';
import { createDefaultSession, createInitialRelicProgress, type Session } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from '../../src/core/playerLevel';
import { ExpeditionManager, ExpeditionClient, ExpeditionBossSettlementFlow } from '../../src/managers/ExpeditionManager';
import { SaveManager } from '../../src/state/SaveManager';
import { createExpeditionBossSkirmishConfig } from '../../src/core/expeditionBattle';
import { expeditionBossGrowth, getExpeditionNodeEnemies } from '../../src/data/expeditionEnemies';
import { expeditionBossDamageScore } from '../../src/core/expeditionScore';
import { getRelic } from '../../src/data/relics';
import { createRaidSkirmishConfig } from '../../src/core/expeditionBattle';
import { raidBossDef, raidBossGrowth, raidBossPercentHpBasis } from '../../src/core/raid';
import { battleArena } from '../../src/core/battleArena';
import { bossBattleRandom } from '../../src/core/bossSimulation';
import { canFireUltimate, createSkirmish, fireUltimate, stepSkirmish } from '../../src/core/skirmish';
import type { EnterRaidResponse, SubmitRaidDamageRequest } from '../../src/api/contracts';
import type { ExpeditionBossAction } from '../../src/core/expeditionBoss';

export async function runRaidScenarios(sql: (query: string) => string) {
  const q = (v: unknown): string => v === null ? 'null' : `'${String(typeof v === 'string' ? v : JSON.stringify(v)).replaceAll("'", "''")}'`;
  let now = new Date(), sequence = 0, conflicts = 0;
  let injectConflict = false, failCommit = false, failSettlement = false, lostReplies = 0;
  const rpcStore = createSupabaseStore({url:'https://isolated.invalid',serviceKey:'isolated-test-only',fetchImpl:async(url,init)=>{
    const name=String(url).split('/').at(-1)!, args=JSON.parse(String(init?.body));
    try { return new Response(sql(`select public.${name}(${Object.entries(args).map(([k,v])=>`${k} => ${q(v)}`).join(',')});`) || 'null'); }
    catch(error) {
      const message = String((error as {stderr?:unknown}).stderr ?? error);
      if (/raid_conflict|save_conflict/.test(message)) return new Response(JSON.stringify({message:'raid_conflict'}),{status:409});
      throw error;
    }
  }});
  const store: StateStore = { ...rpcStore, async commit(input) {
    if ((failCommit && ['submitRaidDamage','submitExpeditionBossScore'].includes(input.method)) || (failSettlement && input.method==='settleExpeditionRun')) throw Error('injected persistence failure before commit');
    if (injectConflict && input.method==='submitRaidDamage' && input.raids?.length) {
      injectConflict=false;conflicts++;
      sql(`update public.server_raids set revision=revision+1 where id=${q(input.raids[0].instance.id)}`);
    }
    return rpcStore.commit(input);
  }};
  const makeClient=(id:string,state:Session)=>createRemoteGameApi({getAccessToken:async()=> 'isolated-token',applyState:next=>Object.assign(state,next),newRequestId:()=>`raid-matrix-${++sequence}`,fetchImpl:async(_url,init)=>{
    const request=JSON.parse(String(init?.body));
    try {
      const body=await handleGameCall(id,request,{store,strict:true,now:()=>now});
      if(['submitRaidDamage','submitExpeditionBossScore'].includes(request.method)&&lostReplies>0){lostReplies--;throw Error('lost committed response');}
      return new Response(JSON.stringify(body));
    } catch(error){
      if(error instanceof GameCallError)return new Response(JSON.stringify({ok:false,code:error.code,message:error.message,domainCode:error.domainCode}),{status:error.status});
      throw error;
    }
  }});
  const seed=(suffix:string,prepare?: (state:Session)=>void)=>{
    const id=`00000000-0000-0000-0000-0000000000${suffix}`;
    sql(`insert into auth.users(id) values('${id}');insert into public.players(id) values('${id}') on conflict do nothing;`);
    const state=createDefaultSession();state.party=['rex','mette','torika'];state.wallet.stamina=1000;state.playerResearch=normalizePlayerLevel({level:PLAYER_LEVEL_CAP});
    for(const relic of state.party){state.owned.add(relic);state.relicProgress[relic]={...createInitialRelicProgress(),level:30,breakthrough:2};}
    prepare?.(state);
    const data=saveManager.exportData(state);
    sql(`select public.server_commit_state('${id}',null,${q(data)}::jsonb,'${'b'.repeat(64)}',${data.saveVersion},'{}','seed-matrix',null,'{}');`);
    return {id,state,api:makeClient(id,state)};
  };
  const a=seed('a1'),b=seed('b1');
  const raid=(await a.api.getRaids()).raids.find(r=>r.kind==='world'&&r.status==='active')!;assert(raid);
  const request=(admission:EnterRaidResponse,stopAtMs=10000):{request:SubmitRaidDamageRequest;expected:number}=>{
    const roster=admission.relics!;
    const players=roster.map(({relicId,snapshot})=>({...getRelic(relicId),stats:snapshot.stats}));
    const base=getRelic(admission.raid.bossRelicId),cfg=createRaidSkirmishConfig(players,raidBossDef(base,admission.raid.difficulty),raidBossPercentHpBasis(base,admission.raid.difficulty),admission.raid.remainingHp);
    const state=createSkirmish(cfg.playerDefs,cfg.enemyDefs,battleArena('raid'),Object.fromEntries(roster.map(r=>[r.relicId,r.snapshot.bondLevel])),Object.fromEntries(roster.map(r=>[r.relicId,r.snapshot.breakthrough])),{...cfg,enemyBreakthroughs:[raidBossGrowth(admission.raid.difficulty).breakthrough]});
    const random=bossBattleRandom(admission.replaySeed!),actions:ExpeditionBossAction[]=[];
    while(state.phase==='fight'&&Math.round(state.elapsed*1000)<stopAtMs){
      stepSkirmish(state,.02,random);
      if(state.phase!=='fight')break;
      for(const f of state.fighters.filter(f=>f.side==='player'&&f.summonOwnerId===null&&canFireUltimate(state,f))){
        const energy=f.energy,events=fireUltimate(state,f.id,random);
        if(events.length||f.energy<energy)actions.push({kind:'ultimate',actorId:f.def.id,elapsedMs:Math.round(state.elapsed*1000)});
      }
    }
    return {request:{raidId:raid.id,requestId:admission.requestId,replayVersion:2,actions,...(state.phase==='fight'?{stopAtMs}:{})},expected:Math.round(state.boss!.score)};
  };
  const aa=await a.api.enterRaid({raidId:raid.id,requestId:'matrix-admit-a1',replayVersion:2});
  const ba=await b.api.enterRaid({raidId:raid.id,requestId:'matrix-admit-b1',replayVersion:2});
  const ar=request(aa),br=request(ba);now=new Date(now.getTime()+10000);
  // 아직 전투 중인 10초에 퇴장. 자연 전멸까지의 점수를 추정하면 벽시계 검사에서 거절된다.
  injectConflict=true;
  const first=await a.api.submitRaidDamage(ar.request);assert.equal(first.runDamage,ar.expected);assert(first.runDamage>0);assert.equal(conflicts,1);
  // 저장 실패는 개인 기여/공유 HP/지갑/입장 영수증을 하나도 변경하지 않아야 한다.
  const before=sql(`select row_to_json(r) from public.server_raids r where id=${q(raid.id)}`);
  failCommit=true;await assert.rejects(b.api.submitRaidDamage(br.request));failCommit=false;
  assert.equal(sql(`select row_to_json(r) from public.server_raids r where id=${q(raid.id)}`),before);
  // 커밋 뒤 두 응답 모두 유실. 새 클라이언트/새 HTTP 키에서도 같은 내부 영수증을 복구한다.
  lostReplies=2;await assert.rejects(b.api.submitRaidDamage(br.request));
  b.api=makeClient(b.id,b.state);const recovered=await b.api.submitRaidDamage(br.request);
  console.log(JSON.stringify({phase:"raid-reconnect-receipt",recovered:true,damage:recovered.runDamage}));
  assert.equal(recovered.runDamage,br.expected);
  const loaded=(await a.api.getRaids()).raids.find(r=>r.id===raid.id)!;
  assert.equal(loaded.dealtDamage,raid.dealtDamage+(first.sharedDamage ?? 0)+(recovered.sharedDamage ?? 0));
  assert.equal(loaded.entries.filter(e=>e.playerId===a.id||e.playerId===b.id).length,2);
  assert.equal(loaded.entries.find(e=>e.playerId===b.id)!.damage,br.expected);
  const gold=b.state.wallet.gold;await b.api.submitRaidDamage(br.request);assert.equal(b.state.wallet.gold,gold);
  // 두 유효 입장 이후 남은 HP가 한 판 피해보다 적어지는 마지막 타격 경합.
  const aa2=await a.api.enterRaid({raidId:raid.id,requestId:'matrix-admit-a2',replayVersion:2});
  const ba2=await b.api.enterRaid({raidId:raid.id,requestId:'matrix-admit-b2',replayVersion:2});
  const ar2=request(aa2),br2=request(ba2);now=new Date(now.getTime()+10000);
  // 다른 정상 참가자가 남은 체력을 1까지 깎은 상황을 DB에 준비한다.
  sql(`update public.server_raids set damage=${raid.totalHp-1},revision=revision+1 where id=${q(raid.id)}`);
  const kill=await a.api.submitRaidDamage(ar2.request);assert.equal(kill.sharedDamage,1);assert.equal(kill.runDamage,ar2.expected);
  const late=await b.api.submitRaidDamage(br2.request);assert.equal(late.sharedDamage,0);assert.equal(late.runDamage,br2.expected);
  assert.equal(late.raid.remainingHp,0);assert.equal(late.raid.myDamage,br.expected+br2.expected);
  const sigil=a.state.wallet.raidSigil;
  const settled=await a.api.settleRaid({raidId:raid.id,requestId:'matrix-settle-a'});
  assert.equal(a.state.wallet.raidSigil-sigil,settled.granted.reduce((n,r)=>n+(r.currency==='raidSigil'?r.amount:0),0));
  assert(settled.granted.length>0);
  const wallet=a.state.wallet.raidSigil;
  a.api=makeClient(a.id,a.state);await a.api.settleRaid({raidId:raid.id,requestId:'matrix-settle-a'});assert.equal(a.state.wallet.raidSigil,wallet);
  const member=JSON.parse(sql(`select row_to_json(m) from public.server_raid_members m where raid_id=${q(raid.id)} and player_id='${a.id}'`));
  assert.equal(Number(member.damage),first.runDamage+kill.runDamage);assert.equal(member.settled,true);
  console.log(JSON.stringify({phase:'raid-concurrency-matrix',players:2,partialDamage:[first.runDamage,recovered.runDamage],conflictRetries:conflicts,lostResponsesRecovered:2,finalHitShared:[kill.sharedDamage,late.sharedDamage],personalPreserved:true,rewardReceipt:true,duplicateReward:false}));
  // 보스 직전 정상 스냅샷에서 원정의 점수와 정산 경계만 집중한다. 전체 1~20층은 기존 루프가 검사한다.
  const c=seed('c1',state=>{
    const saves=new SaveManager({getItem:()=>null,setItem:()=>{},removeItem:()=>{}});
    const manager=new ExpeditionManager(state,saves,()=>now,true);
    assert(manager.prepareDevelopmentBossShortcut(state.party).ok);
    state.expedition.run!.normalNodeScoreTotal=25000;
    state.expedition.run!.pendingRewards.gold=300;
  });
  const run=c.state.expedition.run!,node=run.nodes.find(n=>n.type==='boss')!;
  const ids=(await c.api.prepareExpeditionBoss({nodeId:node.id})).ids!;assert(ids);
  const input={mode:'expeditionBoss' as const,floor:20 as const,runId:run.runId,nodeId:node.id,relics:run.relics,augments:run.selectedAugments,...ids};
  const players=run.relics.map(r=>({...getRelic(r.relicId),stats:r.snapshot!.stats}));
  const config=createExpeditionBossSkirmishConfig(input,players,getExpeditionNodeEnemies('boss',20));
  const fight=createSkirmish(config.playerDefs,config.enemyDefs,battleArena('expeditionBoss'),Object.fromEntries(run.relics.map(r=>[r.relicId,r.snapshot!.bondLevel])),Object.fromEntries(run.relics.map(r=>[r.relicId,r.snapshot!.breakthrough])),{...config,enemyBreakthroughs:[expeditionBossGrowth().breakthrough]});
  const random=bossBattleRandom(JSON.stringify([run.runId,node.id]));
  while(fight.phase==='fight'&&Math.round(fight.elapsed*1000)<10000)stepSkirmish(fight,.02,random);
  const stopAtMs=Math.round(fight.elapsed*1000),scoreRequest={...ids,runId:run.runId,nodeId:node.id,actions:[],stopAtMs};
  now=new Date(now.getTime()+10000);
  const beforeScore=structuredClone(c.state.expedition);
  failCommit=true;await assert.rejects(c.api.submitExpeditionBossScore(scoreRequest));failCommit=false;
  c.api=makeClient(c.id,c.state);await c.api.getPlayerState();assert.deepEqual(c.state.expedition,beforeScore);
  lostReplies=2;await assert.rejects(c.api.submitExpeditionBossScore(scoreRequest));
  c.api=makeClient(c.id,c.state);await c.api.getPlayerState();
  const expected=25000+expeditionBossDamageScore(Math.round(fight.boss!.score));
  assert.equal(c.state.expedition.bestScore,expected);assert(c.state.expedition.run!.visitedNodeIds.includes(node.id));
  // 점수는 이미 확정됐으나 최종 보상 저장만 실패한 상태. 새 흐름에서 점수를 중복 가산하지 않아야 한다.
  failSettlement=true;
  await assert.rejects(new ExpeditionBossSettlementFlow(c.api,new ExpeditionClient(c.state,c.api,()=>now)).finish(input,[],stopAtMs));
  assert(c.state.expedition.run);failSettlement=false;
  c.api=makeClient(c.id,c.state);const beforeGold=c.state.wallet.gold;
  const final=await new ExpeditionBossSettlementFlow(c.api,new ExpeditionClient(c.state,c.api,()=>now)).finish(input,[],stopAtMs);
  assert.equal(final.score.runScore,expected);assert.equal(final.score.endedAtMs,stopAtMs);
  assert.equal(c.state.expedition.run,null);assert.equal(c.state.wallet.gold-beforeGold,final.settlement.granted.gold ?? 0);
  const finalGold=c.state.wallet.gold;
  await c.api.settleExpeditionRun({runId:input.runId,settlementId:input.settlementId,outcome:'completed'});assert.equal(c.state.wallet.gold,finalGold);
  c.api=makeClient(c.id,c.state);assert.equal((await c.api.getExpeditionWeeklyBest()).bestScore,expected);
  const board=await c.api.getExpeditionLeaderboard();assert(board.entries.some(e=>e.playerId===c.id&&e.score===expected));
  console.log(JSON.stringify({phase:'expedition-partial-matrix',stopAtMs,score:expected,persisted:true,lostResponsesRecovered:2,settlementFailureRecovered:true,rewardGold:final.settlement.granted.gold,leaderboard:true,duplicateReward:false}));
}

export { runRaidScenarios as run };
