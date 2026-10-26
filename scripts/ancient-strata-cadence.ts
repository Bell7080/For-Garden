import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ancientReferenceParty } from "../src/core/ancientStrataSimulation";
import { createAncientStrataSkirmish, stepAncientStrataBattle } from "../src/core/ancientStrataBattle";
import { stepSkirmish } from "../src/core/skirmish";
import { createDifficultyRng } from "../src/core/stageDifficulty";

const args = process.argv.slice(2).filter(arg => arg !== "--cadence");
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) throw new Error("--cadence accepts only --output path.json");
const output = args[1] ?? "work/ancient-cadence.json", cases = [], seeds = [1729,2531,4099,8191,12289];
for (const ids of [["rex","torika","mette"],["pachi","ella","mette"],["deina","torika","ella"]]) {
  const party = ancientReferenceParty(ids,"ceiling",60,10);
  for (const floor of [94,95,106,107,110,118,119,120,123,124]) for (const inputEveryTicks of [1,3,5,10]) {
    const runs = seeds.map(seed => {
      const state = createAncientStrataSkirmish(floor,party.players,party), rng = createDifficultyRng(seed);
      let ticks = 0;
      while (state.phase === "fight") {
        ticks++;
        if (ticks % inputEveryTicks === 0) stepAncientStrataBattle(state,.02,rng);
        else stepSkirmish(state,.02,rng);
      }
      return { seed, won:state.phase === "victory", seconds:state.elapsed, timedOut:state.timeLimitReached === true };
    });
    cases.push({ ids, floor, inputEveryTicks, inputIntervalMs:inputEveryTicks*20, wins:runs.filter(r=>r.won).length, runs });
  }
  console.log(`Input cadence checked: ${ids.join("+")}`);
}
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({version:2,model:"varied-trials-v2",tickSeconds:.02,seeds,battles:cases.length*seeds.length,
  scope:"Core remains at 50Hz; player automatic inputs every 20/60/100/200ms approximate render/battle-speed batching. Enemy AI remains per tick. Sampled checkpoints, not full frontier search or measured device FPS.",cases},null,2)+"\n");
