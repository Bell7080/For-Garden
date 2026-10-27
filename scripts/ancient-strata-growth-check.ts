import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ancientReferenceParty, simulateAncientStrataRun } from "../src/core/ancientStrataSimulation";
const args = process.argv.slice(2).filter(arg => arg !== "--growth-check");
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) throw new Error("--growth-check accepts only --output path.json");
const output = args[1] ?? "work/ancient-growth-check.json";
const seeds = [1729,2531,4099,8191,12289,16381,24593,32749,49157,65521], rows = [];
// 모두 합법적 성장 상태다. Lv40에서 돌파 3단계를 열어도 실제 레벨은 40에 둘 수 있다.
for (const [level, breakthrough] of [[40,2],[40,3],[50,3]]) for (const ids of [["torika","pachi","stella"],["pachi","torika","stella"]]) {
  const party = ancientReferenceParty(ids, "epic", level, 10);
  party.breakthroughs = Object.fromEntries(ids.map(id => [id,breakthrough]));
  for (const floor of [76,83,99,104]) {
    const runs = seeds.map(seed => simulateAncientStrataRun(floor, party, seed));
    rows.push({ level, breakthrough, ids, floor, originalSeedWins: runs.slice(0,5).filter(r => r.won).length,
      heldOutSeedWins: runs.slice(5).filter(r => r.won).length, runs });
  }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output,JSON.stringify({ version:1,scope:"Legal growth-condition sensitivity for torika/pachi/stella only; fixed epic loadout and bond10. Checkpoints do not establish a new continuous frontier or isolate individual characters.",seeds,battles:rows.length*seeds.length,rows },null,2)+"\n");
console.log(`Growth check saved: ${output}; battles=${rows.length*seeds.length}`);
