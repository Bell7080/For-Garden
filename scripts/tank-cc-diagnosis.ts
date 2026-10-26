import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getRelic } from '../src/data/relics';
import { battleArena } from '../src/core/battleArena';
import { ancientReferenceParty, type AncientEquipment } from '../src/core/ancientStrataSimulation';
import { createAncientStrataSkirmish, stepAncientStrataBattle } from '../src/core/ancientStrataBattle';
import { auditCcDensity } from '../src/core/ccDensityAudit';
import { CC_AUDIT_LIMITS } from '../src/core/ccAuditScenarios';
import { applyCombatStatusEffect, isFighterAlive, createSkirmish, stepSkirmish, fireUltimate, type SkirmishEvent } from '../src/core/skirmish';
const args=process.argv.slice(2);
if(args.length!==0&&(args.length!==2||args[0]!=='--output'||!args[1]||args[1].startsWith('--')))throw new Error('Use --output report.json');
const output=args[1]??'work/tank-cc-diagnosis.json';
const round=(n:number)=>Math.round(n*1000000)/1000000;
const variants=['baseline','no-deina-taunt','no-deina-channel-stun','no-torika-echo','no-torika-ultimate-stun','no-ella-taunt','no-ella-pull-and-linked-taunt','deina-cc-off','torika-cc-off','ella-cc-off','all-cc-off'];
const results=[];
for(const equipment of ['bare','epic','ceiling'] as AncientEquipment[])for(const variant of variants)for(const seed of ['1729','4099','12289']){
 const party=ancientReferenceParty(['deina','torika','ella'],equipment,60,10);
 const players=structuredClone(party.players);
 for(const p of players){
  const off=(id:string)=>variant===`${id}-cc-off`||variant==='all-cc-off';
  if(p.id==='deina'){
   if(variant==='no-deina-taunt'||off('deina')){p.basic.statusEffects=p.basic.statusEffects?.filter(e=>e.kind!=='taunt');if(p.ferocityTrait.effectId==='graffitiRun')p.ferocityTrait.taunt.seconds=0;}
   if(variant==='no-deina-channel-stun'||off('deina'))p.ultimate.channel!.basicStatusEffects=[];
  }
  if(p.id==='torika'){
   if(variant==='no-torika-echo'&&p.breakthroughEffects?.ultimate?.kind==='echo')p.breakthroughEffects.ultimate.casts=0;
   if(variant==='no-torika-ultimate-stun'||off('torika'))p.ultimate.statusEffects=[];
   if(off('torika')){
    p.basic.statusEffects=[];
    if(p.breakthroughEffects?.basic?.kind==='periodicGuard')p.breakthroughEffects.basic.tauntSeconds=0;
    if(p.breakthroughEffects?.ferocity?.kind==='feverBulwark')p.breakthroughEffects.ferocity.tauntSeconds=0;
    if(p.ferocityTrait.effectId==='torikaBulwark')p.ferocityTrait.tauntDurationSeconds=0;
   }
  }
  if(p.id==='ella'){
   if(variant==='no-ella-taunt'||off('ella'))p.ultimate.selfGuard!.tauntSeconds=0;
   if(variant==='no-ella-pull-and-linked-taunt'||off('ella')){
    p.ultimate.selfGuard!.pull.radius=0;
    for(const step of p.basic.cycle??[])delete step.pull;
    delete p.passive.undyingKnockback;
   }
   if(off('ella'))for(const step of p.basic.cycle??[])step.statusEffects=[];
  }
 }
 const state=createAncientStrataSkirmish(121,players,party);
 const hard=new Map<string,{seconds:number;intervals:{start:number;end:number}[]}>();
 const ownerSeconds:Record<string,Record<string,number>>={};
 const casts:Record<string,number[]>={},torikaHits:{at:number;echo:boolean;targets:string[]}[]=[];
 const aimTrace:unknown[]=[];
 const amoGapBudget:Record<string,number>={hard:0,cooldown:0,readyOutOfReach:0,readyInReach:0};
 const report=auditCcDensity({id:`tank-diagnosis:${equipment}:${variant}`,seed,durationSeconds:90,stepSeconds:.02,targets:'enemy',limits:CC_AUDIT_LIMITS.stage,createState:()=>state,
  step:(s,dt,rng)=>{
   const before=s.elapsed;
   const oldEnergy=new Map(s.fighters.map(f=>[f.id,f.energy]));
   const oldAim=new Map(s.fighters.filter(f=>f.side==='enemy').map(f=>[f.id,{target:f.targetId,taunt:f.taunted?.sourceId}]));
   const events=stepAncientStrataBattle(s,dt,rng);
   for(const f of s.fighters){
    if((oldEnergy.get(f.id)??0)-f.energy>40)(casts[f.def.id]??=[]).push(round(s.elapsed));
    if(f.side!=='enemy')continue;
    const row=hard.get(f.id)??{seconds:0,intervals:[]};hard.set(f.id,row);
    if(isFighterAlive(f)&&(f.stunnedFor>0||f.staggeredFor>0||f.frozen||f.knockback)){
     row.seconds+=s.elapsed-before;
     const last=row.intervals.at(-1);if(last&&Math.abs(last.end-before)<1e-7)last.end=s.elapsed;else row.intervals.push({start:before,end:s.elapsed});
    }
    if(f.taunted&&isFighterAlive(f)){
     const owner=s.fighters.find(a=>a.id===f.taunted!.sourceId)?.def.id??f.taunted.sourceId;
     const durations=ownerSeconds[f.def.id]??={};durations[owner]=(durations[owner]??0)+(s.elapsed-before);
    }
    if(variant==='baseline'&&equipment==='ceiling'&&seed==='1729'&&f.def.id==='amo'&&before>=14.58-1e-8&&isFighterAlive(f)){const key=(f.stunnedFor>0||f.staggeredFor>0||f.frozen||f.knockback)?'hard':f.attackCooldown>0?'cooldown':!f.engaged?'readyOutOfReach':'readyInReach';amoGapBudget[key]+=s.elapsed-before;}
    const old=oldAim.get(f.id);
    if(variant==='baseline'&&equipment==='ceiling'&&seed==='1729'&&(old?.target!==f.targetId||old?.taunt!==f.taunted?.sourceId))aimTrace.push({at:round(s.elapsed),id:f.def.id,target:f.targetId,taunt:f.taunted?.sourceId??null,stun:round(f.stunnedFor),cooldown:round(f.attackCooldown),gap:f.targetId?round(Math.hypot(f.x-s.fighters.find(a=>a.id===f.targetId)!.x,f.y-s.fighters.find(a=>a.id===f.targetId)!.y)):null});
   }
   const hits=events.filter(e=>e.kind==='attack'&&s.fighters.find(f=>f.id===e.attackerId)?.def.id==='torika'&&e.skill==='ultimate');
   if(hits.length)torikaHits.push({at:round(s.elapsed),echo:!(casts.torika??[]).includes(round(s.elapsed)),targets:hits.flatMap(e=>e.kind==='attack'?[e.targetId]:[])});
   return events;
  }});
 const units=report.units.map(u=>({...u,hardContinuousSeconds:round(Math.max(0,...hard.get(u.fighterId)!.intervals.map(i=>i.end-i.start))),hardIntervals:hard.get(u.fighterId)!.intervals.map(i=>({start:round(i.start),end:round(i.end)})),tauntOwnerSeconds:Object.fromEntries(Object.entries(ownerSeconds[u.relicId]??{}).map(([k,v])=>[k,round(v)]))}));
 results.push({equipment,variant,seed,phase:report.phase,elapsed:report.elapsedSeconds,casts,torikaHits,units,...(variant==='baseline'&&equipment==='ceiling'&&seed==='1729'?{amoGapBudget:{windowStartSeconds:14.58,...Object.fromEntries(Object.entries(amoGapBudget).map(([k,v])=>[k,round(v)]))}}:{}),...(aimTrace.length?{aimTrace}:{})});
}
// One shared-slot contract probe: can a rejected short taunt still heal its caster?
const p=ancientReferenceParty(['deina','torika','ella'],'bare');const s=createAncientStrataSkirmish(121,p.players,p);const d=s.fighters[0],e=s.fighters[2],target=s.fighters[3];d.hp=d.maxHp/2;const events:SkirmishEvent[]=[];
applyCombatStatusEffect(target,{kind:'taunt',seconds:5},events,s,e.id);const hpBefore=d.hp;
applyCombatStatusEffect(target,{kind:'taunt',seconds:.75},events,s,d.id);
const tauntProbe={hpBefore,hpAfter:d.hp,heal:d.hp-hpBefore,remaining:target.taunted?.remaining,owner:target.taunted?.sourceId,attemptedOwner:d.id,events};
// Isolate the enemy non-attacking ultimate route without CC or incoming player attacks.
function aiProbe(manual:boolean){
 const state=createSkirmish([getRelic('dodo')],[getRelic('amo')],battleArena('stage'));
 const [player,enemy]=state.fighters;player.x=500;player.y=1000;player.stunnedFor=99;enemy.x=530;enemy.y=1000;enemy.attackCooldown=0;enemy.energy=enemy.def.ultimate.cost;
 const events=manual?fireUltimate(state,enemy.id,()=>.5):stepSkirmish(state,.02,()=>.5);
 return {manual,energy:enemy.energy,shield:enemy.shield.amount,enemyCooldown:enemy.attackCooldown,playerTauntedBy:player.taunted?.sourceId??null,events};
}
const nonAttackingEnemyUltimateProbe={automatic:aiProbe(false),directSharedCast:aiProbe(true)};
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({scope:'Lv60 BT4 bond10, ancient B121, actual native engine at 50Hz. Counterfactuals remove only specified skill effects; deaths/duration may change. No production balance changes.',results,tauntProbe,nonAttackingEnemyUltimateProbe},null,2)+'\n');
console.log(JSON.stringify({output,cases:results.length,tauntProbe,nonAttackingEnemyUltimateProbe}));
