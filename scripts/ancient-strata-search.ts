import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RELICS } from "../src/data/relics";
import { ancientReferenceParty, simulateAncientStrataRun } from "../src/core/ancientStrataSimulation";
const args = process.argv.slice(2).filter(arg => arg !== "--search");
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) throw new Error("--search accepts only --output path.json");
const output = args[1] ?? "work/ancient-strata-search.json";
const playable = RELICS.filter(r => !r.enemyOnly && !r.summonOnly);
const tanks = playable.filter(r => r.role === "tank"), damage = playable.filter(r => r.role === "warrior" || r.role === "assassin"), supports = playable.filter(r => r.role === "support");
const seed = 1729, rows = [];
let battles = 0;
for (const tank of tanks) for (const dealer of damage) for (const support of supports) for (const order of [[tank.id, dealer.id, support.id], [dealer.id, tank.id, support.id]]) {
  if (new Set(order).size !== 3) continue;
  const party = ancientReferenceParty(order, "ceiling");
  const screen = simulateAncientStrataRun(100, party, seed); battles++;
  if (!screen.won) continue;
  const checkpoints = [100, 110, 120, 124, 130, 150, 200].map(floor => {
    const runs = [1729, 2531, 4099, 8191, 12289].map(seed => { battles++; return simulateAncientStrataRun(floor, party, seed); });
    return { floor, wins: runs.filter(r => r.won).length, runs };
  });
  rows.push({ party: order, checkpoints });
}
rows.sort((a, b) => {
  const score = (row: typeof a) => row.checkpoints.reduce((sum, c) => sum + c.wins * c.floor, 0);
  return score(b) - score(a);
});
const report = { version: 2, model: "varied-trials-v2", tickSeconds: 1 / 50, scope: "All tank + warrior/assassin + support combinations, two orders; legendary reference loadout, bond 10. One-seed floor100 screen; survivors checked at five seeds. Not an exhaustive search of all legal three-unit teams, rune traits or orders.",
  screenSeed: seed, tanks: tanks.map(r => r.id), dealers: damage.map(r => r.id), supports: supports.map(r => r.id),
  battles, candidatesPassingScreen: rows.length, candidates: rows };
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Search complete: battles=${battles}, passing=${rows.length}`);
for (const row of rows.slice(0, 12)) console.log(row.party.join("+"), row.checkpoints.map(c => `${c.floor}:${c.wins}/5`).join(" "));
