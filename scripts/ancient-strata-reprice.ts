import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ancientReferenceParty, simulateAncientStrataRun, type AncientEquipment } from "../src/core/ancientStrataSimulation";
import { getAncientStrataFloor } from "../src/core/ancientStrataBattle";
const probe=process.argv.includes("--probe");
const args = process.argv.slice(2).filter(arg => arg !== "--reprice" && arg !== "--probe");
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) throw new Error("--reprice accepts only --output path.json");
const output = args[1] ?? "work/ancient-reprice.json", seeds = [1729,2531,4099,8191,12289];
const references = [["rex","torika","mette"],["torika","rex","mette"],["ark","pachi","stella"],["pachi","ark","stella"],["pachi","ella","mette"],["nodonia","dian","meron"],["torika","luka","stella"],["ella","morphe","mette"]];
const results = [];
for (const ids of references) for (const equipment of ["bare","epic","ceiling"] as AncientEquipment[]) {
  const party = ancientReferenceParty(ids,equipment,60,10),floors = [];
  for (let floor=1;floor<=200;floor++) {
    const runs = seeds.map(seed=>simulateAncientStrataRun(floor,party,seed));
    floors.push({ floor, wins:runs.filter(r=>r.won).length, runs:runs.map(r=>({seed:r.seed,won:r.won,seconds:r.seconds,hp:r.playerHpRatio,timedOut:r.timedOut})) });
    if(probe && floors.at(-1)!.wins<4)break;
  }
  let stableThrough=0;
  for (const row of floors) { if(row.wins<4)break;stableThrough=row.floor; }
  const row={ids,equipment,level:60,breakthrough:4,bond:10,stableThrough,highestAnyWin:Math.max(0,...floors.filter(r=>r.wins).map(r=>r.floor)),floors};
  results.push(row);console.log(`${ids.join('+')} ${equipment}: stable=${stableThrough}, highest=${row.highestAnyWin}`);
}
const definitions=Array.from({length:200},(_,i)=>getAncientStrataFloor(i+1)).map(({enemies,...d})=>({...d,enemies:enemies.map(e=>({id:e.id,role:e.encounterRole,stats:e.stats}))}));
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({version:2,model:"varied-trials-v2",probe,tickSeconds:1/50,seeds,battles:results.reduce((sum,r)=>sum+r.floors.length*seeds.length,0),results,definitions},null,2)+'\n');
