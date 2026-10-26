import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ancientReferenceParty, simulateAncientStrataRun } from "../src/core/ancientStrataSimulation";
import { createCcCombatScenario } from "../src/core/ccAuditScenarios";
import { auditCcDensity } from "../src/core/ccDensityAudit";
const args = process.argv.slice(2).filter(arg => arg !== "--robustness");
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) throw new Error("--robustness accepts only --output path.json");
const output = args[1] ?? "work/ancient-strata-robustness.json";
const parties = [["rex", "torika", "mette"], ["ark", "pachi", "stella"], ["pachi", "ella", "mette"], ["deina", "pachi", "stella"], ["pachi", "mosana", "stella"]];
const sensitivity = [], cc = [];
for (const ids of parties) {
  const party = ancientReferenceParty(ids, "ceiling");
  for (const floor of [90, 100, 110, 120, 121, 130, 200]) for (const control of ["auto", "manualUltimate"] as const) for (const fps of [30, 60, 120]) {
    const runs = [1729, 2531, 4099].map(seed => simulateAncientStrataRun(floor, party, seed, control, 1 / fps));
    sensitivity.push({ party: ids, floor, control, fps, wins: runs.filter(run => run.won).length, runs });
  }
  for (const floor of [100, 120, 121]) {
    const scenario = createCcCombatScenario({ mode: "ancient", floor, party: ids, equipment: "ceiling", durationSeconds: 90 });
    const report = auditCcDensity({ ...scenario, targets: "all", includeTimeline: false });
    cc.push({ party: ids, floor, ...report });
  }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ version: 2, model: "varied-trials-v2", note: "Manual is a healing/support timing heuristic, not an optimal human policy; 30/60/120Hz change the engine step and input cadence together; use --cadence for fixed-50Hz render/input batching sensitivity. These are not interchangeable seeds. CC uses its own named seed stream. Strict CC violations are preserved, not relabeled as passes.", bondLevel: 10, sensitivityBattles: sensitivity.length * 3, sensitivity, cc }, null, 2) + "\n");
console.log(`Robustness complete: ${sensitivity.length * 3} battles; ${cc.length} CC audits`);
