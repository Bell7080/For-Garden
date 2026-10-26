import { describe, expect, it } from "vitest";
import { createDefaultSession, createInitialRelicProgress } from "../../src/state/session";
import { saveManager } from "../../src/state/SaveManager";
import { emptyServerJournal } from "../../src/core/serverJournal";
import { handleGameCall, type StateStore, type StoredState } from "../../src/server/gameHandler";
import { combatState, COMBAT_STEP_MS, type CombatLease } from "../../src/core/combatProtocol";
import { bossBattleRandom } from "../../src/core/bossSimulation";
import { canFireUltimate, fireUltimate, stepSkirmish, createSkirmish, percentHpDamage } from "../../src/core/skirmish";
import { ancientStageId, ancientStageFloor } from "../../src/data/ancientStrataDifficulty";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { getAncientStrataFloor } from "../../src/core/ancientStrataBattle";
import { battleArena } from "../../src/core/battleArena";

function service(unlocked = true, unlockedFloor = 1) {
  const state = createDefaultSession();
  state.serverJournal=emptyServerJournal();
  state.wallet.gems=1234;state.wallet.stamina=0;state.staminaUpdatedAt="2026-10-26T00:00:00Z";
  state.party=["rex","torika","mette"];
  for(const id of state.party) {
    state.owned.add(id);
    state.relicProgress[id]={...createInitialRelicProgress(),level:60,breakthrough:4};
  }
  if(unlocked)state.cleared.add("1-10");
  for(let floor=1;floor<unlockedFloor;floor++)state.cleared.add(ancientStageId(floor));
  let stored:StoredState={data:saveManager.exportData(state),revision:"1"};
  const receipts=new Map<string,unknown>();
  const store:StateStore={load:async()=>stored,findReceipt:async(_id,key)=>receipts.get(key),commit:async input=>{
    expect(input.expectedRevision).toBe(stored.revision);
    const revision=String(Number(stored.revision)+1);
    stored={data:structuredClone(input.data),revision};
    if(input.requestId)receipts.set(input.requestId,{...(input.response as object),revision});
    return{revision};
  }};
  let now=new Date("2026-10-26T00:00:00Z"),sequence=0;
  const call=(method:string,args:unknown[]=[],requestId=`ancient-call-${++sequence}`)=>handleGameCall("player",{method,args,requestId},{store,strict:true,now:()=>now,random:()=>.5});
  return {call,snapshot:()=>saveManager.parse(structuredClone(stored.data)),advance:()=>{now=new Date(now.getTime()+300000)}};
}
async function verifiedWin(s:ReturnType<typeof service>) {
  await s.call("enterStage",[{stageId:"ancient:1",requestId:crypto.randomUUID()}]);
  const lease=(await s.call("prepareCombat",[{input:{mode:"stage"},stageId:"ancient:1",automaticUltimates:true}])).result as CombatLease;
  const fight=combatState(lease),rng=bossBattleRandom(lease.seed),actions:Array<{tick:number;actorId:string}>=[];
  let ticks=0;
  while(fight.phase==="fight"&&ticks<4500) {
    stepSkirmish(fight,COMBAT_STEP_MS/1000,rng);ticks++;
    for(const f of fight.fighters.filter(f=>f.side==="player"&&f.summonOwnerId===null)) {
      if(canFireUltimate(fight,f)){actions.push({tick:ticks,actorId:f.id});fireUltimate(fight,f.id,rng);}
    }
  }
  expect(fight.phase).toBe("victory");
  s.advance();
  expect((await s.call("finishCombat",[{id:lease.id,ticks,actions}])).result).toMatchObject({victory:true});
}

describe("고대 지층 서버 입장·첫 보상·재전송",()=>{
  it.each([4,5,6,121])("%i층의 시련과 심층 피해 기준을 서버 발급 전투에도 적용한다",async floor=>{
    const s=service(true,floor),stageId=ancientStageId(floor);
    await s.call("enterStage",[{stageId,requestId:`trial-entry-${floor}`}]);
    const lease=(await s.call("prepareCombat",[{input:{mode:"stage"},stageId}])).result as CombatLease;
    const fight=combatState(lease),definition=getAncientStrataFloor(floor);
    expect(fight.timeLimitSeconds).toBe(definition.timeLimitSeconds);
    expect(fight.automaticUltimates).not.toBe(true);
    const enemies=fight.fighters.filter(f=>f.side==="enemy"&&f.summonOwnerId===null);
    expect(enemies.map(f=>f.def.stats)).toEqual(definition.enemies.map(e=>e.stats));
    expect(enemies.map(f=>f.percentHpBasis)).toEqual(definition.enemyPercentHpBases);
    if(floor===5)expect(enemies.every(f=>f.shield.amount>0)).toBe(true);
    if(floor===6)expect(enemies.every(f=>f.energy/f.def.ultimate.cost>=.19)).toBe(true);
  });

  it("1-10 이전 입장과 층 건너뛰기·클라이언트 승리 주장만으로는 보상을 허용하지 않는다",async()=>{
    const locked=service(false);
    await expect(locked.call("enterStage",[{stageId:"ancient:1",requestId:"entry-locked"}])).rejects.toThrow();
    const s=service();
    await expect(s.call("enterStage",[{stageId:"ancient:2",requestId:"entry-skipped"}])).rejects.toThrow();
    await expect(s.call("completeStage",["ancient:1",true])).rejects.toThrow("COMBAT_NOT_VERIFIED");
    expect(s.snapshot().wallet.gems).toBe(1234);
    for(const id of ["ancient:0","ancient:201","ancient:01","ancient:1junk"])expect(()=>getBattleStage(id)).toThrow();
    expect(ancientStageFloor("ancient:200")).toBe(200);
  });

  it("서버 재현 첫 승리만 젬100을 원자 저장하고, 같은 요청/재클리어로 추가 지급하지 않는다",async()=>{
    const s=service();await verifiedWin(s);
    const first=await s.call("completeStage",["ancient:1",false],"ancient-first-claim");
    expect(first.result).toMatchObject({firstClear:true,staminaSpent:0,firstClearRewards:[{kind:"currency",currency:"gems",amount:100}]});
    const saved=s.snapshot();expect(saved.wallet.gems).toBe(1334);expect(saved.cleared.has("ancient:1")).toBe(true);
    expect(saved.selectedStageId).toBe("ancient:1");
    await s.call("completeStage",["ancient:1",false],"ancient-first-claim");
    expect(s.snapshot().wallet.gems).toBe(1334);
    await expect(s.call("completeStage",["ancient:1",true])).rejects.toThrow("COMBAT_NOT_VERIFIED");
    await verifiedWin(s);
    expect((await s.call("completeStage",["ancient:1",true])).result).toMatchObject({firstClear:false,firstClearRewards:[],cheesecakeEarned:0,staminaSpent:0});
    const replay=s.snapshot();expect(replay.wallet.gems).toBe(1334);
    expect(replay.relicProgress.rex.bondXp).toBe(saved.relicProgress.rex.bondXp);
    await expect(s.call("enterStage",[{stageId:"ancient:2",requestId:"entry-next-floor"}])).resolves.toBeDefined();
  },15000);
});

describe("공용 전투 제한과 심층 비례 피해",()=>{
  it("제한이 없는 기존 전투를 바꾸지 않고 제한을 넘는 틱은 마지막 시각에서 패배한다",()=>{
    const base=getRelic("dodo"),unit={...base,stats:{...base.stats,hp:1e12,atk:1,ap:1,def:1e8,res:1e8}};
    const limited=createSkirmish([unit],[unit],battleArena("ancient"),{}, {},{timeLimitSeconds:.06});
    const events=stepSkirmish(limited,.2,()=>.5);
    expect(limited.elapsed).toBeCloseTo(.06,8);expect(limited.phase).toBe("defeat");expect(limited.timeLimitReached).toBe(true);
    expect(events.filter(e=>e.kind==="finish")).toEqual([{kind:"finish",phase:"defeat"}]);
    expect(stepSkirmish(limited,.2)).toEqual([]);
    const original=createSkirmish([unit],[unit],battleArena("stage"));
    stepSkirmish(original,.2);expect(original.phase).toBe("fight");expect(original.timeLimitReached).toBeUndefined();
  });

  it("심층의 실제 HP는 증가하되 비례 피해 기준의 120층 이후 추가 증폭을 제외한다",()=>{
    const d=getAncientStrataFloor(200),defs=getStageEnemies(getBattleStage(ancientStageId(200)));
    expect(defs.map(e=>e.stats)).toEqual(d.enemies.map(e=>e.stats));
    for(const [i,def]of d.enemies.entries()) {
      expect(d.enemyPercentHpBases[i]).toBeLessThan(def.stats.hp);
      expect(percentHpDamage({def,maxHp:def.stats.hp,percentHpBasis:d.enemyPercentHpBases[i]},10)).toBeCloseTo(Math.round(d.enemyPercentHpBases[i]*.1),0);
    }
    for(const floor of [1,60,120]) {
      const normal=getAncientStrataFloor(floor);
      expect(normal.enemyPercentHpBases).toEqual(normal.enemies.map(e=>e.stats.hp));
    }
    expect(getAncientStrataFloor(4).timeLimitSeconds).toBe(60);
  });
});
