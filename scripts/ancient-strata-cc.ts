import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditCcDensity } from "../src/core/ccDensityAudit";
import { createCcCombatScenario } from "../src/core/ccAuditScenarios";

const args = process.argv.slice(2).filter(arg => arg !== "--cc");
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) throw new Error("--cc accepts only --output path.json");
const output = args[1] ?? "work/ancient-cc.json";
const cases = [];
// 실제 생존/사망을 유지한다. 조기 사망으로 관찰이 짧으면 안전으로 판정하지 않는다.
for (const party of [["rex", "torika", "mette"], ["pachi", "ella", "mette"], ["deina", "torika", "ella"]]) {
  for (const floor of [1, 2, 3, 5, 7, 10, 50, 90, 100, 110, 120, 121]) {
    for (const seed of ["1729", "4099", "12289"]) {
      const scenario = createCcCombatScenario({ mode: "ancient", floor, party, equipment: "ceiling", level: 60, seed });
      cases.push(auditCcDensity({ ...scenario, id: `${scenario.id}:${party.join("+")}`, targets: "all" }));
    }
  }
  console.log(`CC audited: ${party.join("+")}`);
}
const summary = Object.fromEntries(["pass", "fail", "insufficient"].map(verdict => [verdict, cases.filter(row => row.verdict === verdict).length]));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ version: 2, model: "varied-trials-v2", tickSeconds: .02,
  scope: "Actual stage auto input, both teams, native skills, trials, time limits; no expedition augments or HP inflation. Finite samples cannot prove absence of infinite CC.", summary, cases }, null, 2) + "\n");
console.log(JSON.stringify(summary));
