import { compareCcAuditPairs } from "../src/core/ccAuditComparison";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditCcDensity, type CcAuditReport } from "../src/core/ccDensityAudit";
import { createCcMobilityScenarios, createCcEngagementScenarios, createCcCombatScenario, createCcStressScenario, createCcMatrixScenarios, CC_AUGMENT_FAMILIES } from "../src/core/ccAuditScenarios";
import { getExpeditionAugment } from "../src/data/expeditionAugments";

const args = process.argv.slice(2);
function value(flag: string): string | undefined { const index=args.indexOf(flag); if(index<0)return undefined; const next=args[index+1]; if(!next||next.startsWith('--'))throw new Error(`Missing value: ${flag}`);return next; }
const flags = new Set(["--floor","--equipment","--targets","--mode","--stage","--boss","--party","--level","--duration","--seed","--augments","--output","--matrix","--mobility","--engagement","--quick","--fail-on-risk","--help"]);
for(let i=0;i<args.length;i++){if(!flags.has(args[i]))throw new Error(`Unknown option: ${args[i]}`);if(!["--matrix","--mobility","--engagement","--quick","--fail-on-risk","--help"].includes(args[i]))i++;}
if(args.includes('--help')){
 console.log('audit:cc --mode stage|raid|endless|ancient|stress [--targets enemy|player|all] [--stage 1-10] [--floor 100] [--equipment bare|epic|ceiling] [--boss koma] [--party pachi,mosana,anka] [--level 60] [--duration 30] [--seed value] [--augments id@relic,id@relic] [--matrix|--engagement|--mobility [--quick]] [--output report.json] [--fail-on-risk]');
}else{
 const mode=value('--mode')??'stress';if(!['stage','raid','endless','ancient','stress'].includes(mode))throw new Error(`Invalid mode: ${mode}`);
 const duration=value('--duration')===undefined?30:Number(value('--duration'));
 const targets=value('--targets') ?? 'enemy';
 if(!['enemy','player','all'].includes(targets))throw new Error(`Invalid targets: ${targets}`);
 const seed=value('--seed'), raw=value('--augments');
 const selections=raw?.split(',').map(item=>{const [augmentId,targetRelicId,...rest]=item.split('@');const def=getExpeditionAugment(augmentId);if(!def||rest.length||def.target==='relic'&&!targetRelicId)throw new Error(`Invalid augment assignment: ${item}`);return {augmentId,...(targetRelicId?{targetRelicId}:{})};});
 let result: unknown, failures=0, insufficient=0;
 if((args.includes('--matrix') || args.includes('--mobility') || args.includes('--engagement'))){
  if(mode!=='stress')throw new Error('--matrix requires --mode stress');
  const scenarios=(args.includes('--mobility') ? createCcMobilityScenarios : args.includes('--engagement') ? createCcEngagementScenarios : createCcMatrixScenarios)({durationSeconds:duration,quick:args.includes('--quick'),seed});
  const cases=[];
  for(const [i,scenario] of scenarios.entries()){
   const report=auditCcDensity({...scenario,targets:targets as "enemy"|"player"|"all"});
   if(report.verdict==='fail')failures++;if(report.verdict==='insufficient')insufficient++;
   cases.push({id:report.id,verdict:report.verdict,metadata:report.metadata,combatants:report.combatants,units:report.units});
   if((i+1)%100===0)process.stderr.write(`CC audit: ${i+1}/${scenarios.length}\n`);
  }
  const score=(entry:typeof cases[number])=>Math.max(0,...entry.units.map(unit=>unit.longestContinuousSeconds));
  const ranked=[...cases].sort((a,b)=>score(b)-score(a));
  const worstScenario=scenarios.find(scenario=>scenario.id===ranked[0]?.id);
  const worstCase=worstScenario?auditCcDensity({...worstScenario,targets:targets as "enemy"|"player"|"all",includeTimeline:true}):undefined;
  result={kind:'cc-density-matrix',version:1,summary:{cases:cases.length,failed:failures,insufficient,maxContinuousSeconds:Math.max(0,...cases.flatMap(row=>row.units.map(unit=>unit.longestContinuousSeconds))),maxControlledRatio:Math.max(0,...cases.flatMap(row=>row.units.map(unit=>unit.controlledRatio)))},pairedComparisons:compareCcAuditPairs(cases),worstCase,cases};
 }else{
  const scenario=mode==='stress'?createCcStressScenario({selections,ids:selections?.map(selection=>selection.augmentId)??CC_AUGMENT_FAMILIES.map((kind,i)=>`tag-${kind}-${i%2?'ultimate':'basic'}`),durationSeconds:duration,seed})
   :createCcCombatScenario({mode:mode as 'stage'|'raid'|'endless'|'ancient',floor:value('--floor')===undefined?undefined:Number(value('--floor')),equipment:value('--equipment') as 'bare'|'epic'|'ceiling'|undefined,stageId:value('--stage'),bossId:value('--boss'),party:value('--party')?.split(','),level:value('--level')===undefined?undefined:Number(value('--level')),durationSeconds:duration,seed,selections});
  const assignedParty = new Set(mode === 'stress' ? ['cc-0','cc-1','cc-2'] : (value('--party')?.split(',') ?? ['pachi','mosana','anka']));
  if(selections?.some(s => s.targetRelicId && !assignedParty.has(s.targetRelicId)))throw new Error('Augment target must belong to the simulated party');
  const report:CcAuditReport=auditCcDensity({...scenario,targets:targets as "enemy"|"player"|"all"});result=report;failures=report.verdict==='fail'?1:0;insufficient=report.verdict==='insufficient'?1:0;
 }
 const json=JSON.stringify(result,null,2)+'\n',output=value('--output');
 if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,json);console.log(`CC audit saved: ${output}; failed=${failures}; insufficient=${insufficient}`);}else process.stdout.write(json);
 if(args.includes('--fail-on-risk')&&(failures||insufficient))process.exitCode=1;
}
