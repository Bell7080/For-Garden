import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getRelic } from "../src/data/relics";
import { ANCIENT_GROWTH_COHORTS, ancientRegularParties, inspectAncientStableFrontier } from "../src/core/ancientStrataCohorts";
import type { AncientEquipment } from "../src/core/ancientStrataSimulation";
const args = process.argv.slice(2).filter(arg => arg !== "--cohorts");
const opts = new Map<string,string>();
for (let i=0;i<args.length;i+=2) {
  if (!["--output","--group"].includes(args[i]) || !args[i+1] || args[i+1].startsWith("--") || opts.has(args[i])) throw new Error("--cohorts accepts --output path.json and optional --group sr50|sr40|ssr30|mixed20");
  opts.set(args[i],args[i+1]);
}
const group = opts.get("--group");
if (group && !ANCIENT_GROWTH_COHORTS.some(c => c.id === group)) throw new Error("Invalid cohort group");
const output = opts.get("--output") ?? "work/ancient-growth-cohorts.json", seeds = [1729,2531,4099,8191,12289], bondLevel = 10;
const results = [], csv = ["cohort,level,breakthrough,bond,tank,dealer,support,equipment,order,stableThrough,firstUnstableFloor,unstableFloorWins"];
let battles = 0;
for (const cohort of ANCIENT_GROWTH_COHORTS.filter(c => !group || c.id === group)) {
  const parties = ancientRegularParties(cohort);
  for (const [index, [tank, dealer, support]] of parties.entries()) {
    const cases = [];
    for (const equipment of ["bare", "epic"] as AncientEquipment[]) for (const order of ["tank-first", "dealer-first"]) {
      const ids = order === "tank-first" ? [tank, dealer, support] : [dealer, tank, support];
      const report = inspectAncientStableFrontier(ids, cohort.level, equipment, seeds, bondLevel);
      battles += report.floors.length * seeds.length;
      cases.push({ equipment, order, ids, ...report, floors: report.floors.map(({ runs, ...floor }) => ({ ...floor,
        meanSeconds: runs.reduce((sum, run) => sum + run.seconds, 0) / runs.length,
        meanHp: runs.reduce((sum, run) => sum + run.playerHpRatio, 0) / runs.length,
        // 승패와 사망/시간 초과를 재확인할 수 있게 개별 시드를 보존한다.
        runs: runs.map(run => ({ seed: run.seed, won: run.won, timedOut: run.timedOut, seconds: run.seconds, hp: run.playerHpRatio })) })) });
      csv.push([cohort.id, cohort.level, report.breakthrough, bondLevel, tank, dealer, support, equipment, order, report.stableThrough, report.firstUnstableFloor ?? "", report.firstUnstableFloor ? report.floors.at(-1)!.wins : ""].join(","));
    }
    results.push({ cohort: cohort.id, level: cohort.level, members: [tank, dealer, support].map(id => {
      const r = getRelic(id); return { id, name: r.name, rarity: r.rarity, role: r.role };
    }), cases });
    if ((index + 1) % 25 === 0) console.log(`${cohort.id}: ${index + 1}/${parties.length}; battles=${battles}`);
  }
  console.log(`${cohort.id} complete: ${parties.length} compositions`);
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ version: 2, model: "varied-trials-v2", seeds, bondLevel, timeLimits: { standard: 90, deadline: 60 }, equipment: ["bare", "epic"], control: "auto", tickSeconds: 1 / 50,
  criterion: "4/5 wins at EVERY preceding floor. Stop immediately at first unstable floor; no claim of maximum lucky win or subsequent rebounds.",
  scope: "Every playable regular composition in the four requested cohorts; tank-first and dealer-first orders. Not all six orders, gear traits or manual policies.",
  compositions: results.length, configurations: results.length * 4, battles, results }, null, 2) + "\n");
writeFileSync(output.replace(/\.json$/i, "") + ".csv", csv.join("\n") + "\n");
console.log(`Cohorts saved: ${output}; compositions=${results.length}; configurations=${results.length * 4}; battles=${battles}`);
