import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ANCIENT_REFERENCE_PARTIES, ancientReferenceParty, simulateAncientStrataRun, type AncientEquipment } from "../src/core/ancientStrataSimulation";
import { getAncientStrataFloor } from "../src/core/ancientStrataBattle";
import type { DifficultyControl } from "../src/core/stageDifficulty";
const args = process.argv.slice(2);
const flags = new Set(["--quick", "--help"]), options = new Set(["--output", "--party", "--equipment", "--seeds", "--control", "--floor", "--step", "--bond", "--level"]);
const values = new Map<string, string>();
for (let index = 0; index < args.length; index++) {
  const key = args[index];
  if (values.has(key)) throw new Error(`Duplicate option: ${key}`);
  if (flags.has(key)) values.set(key, "true");
  else if (options.has(key) && args[index + 1] && !args[index + 1].startsWith("--")) values.set(key, args[++index]);
  else throw new Error(`Unknown option or missing value: ${key}`);
}
if (values.has("--help")) {
  console.log("audit:ancient --cohorts [--output report.json] : requested regular-party growth cohorts");
  console.log("audit:ancient [--quick] [--party rex,torika,mette] [--equipment bare|epic|ceiling] [--seeds 1729,2531] [--control auto|manualUltimate] [--floor 100] [--step 0.03333333333333333] [--bond 10] [--level 60] [--output report.json]");
} else {
  const quick = values.has("--quick");
  const seeds = values.has("--seeds") ? values.get("--seeds")!.split(",").map(Number) : quick ? [1729] : [1729, 2531, 4099, 8191, 12289];
  if (!seeds.length || seeds.some(seed => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff)) throw new RangeError("Seeds must be uint32 integers");
  const control = values.get("--control") ?? "auto";
  if (control !== "auto" && control !== "manualUltimate") throw new Error("Invalid control");
  const equipment = values.get("--equipment");
  if (equipment && !["bare", "epic", "ceiling"].includes(equipment)) throw new Error("Invalid equipment");
  const level = Number(values.get("--level") ?? 60);
  const bondLevel = Number(values.get("--bond") ?? 10);
  const step = Number(values.get("--step") ?? 1 / 30);
  if (!Number.isFinite(step) || step < 1 / 120 || step > 1 / 20) throw new Error("Invalid step");
  const onlyFloor = values.has("--floor") ? Number(values.get("--floor")) : undefined;
  if (onlyFloor !== undefined) getAncientStrataFloor(onlyFloor);
  const references = values.has("--party") ? [{ id: "custom", relics: values.get("--party")!.split(",") }] : ANCIENT_REFERENCE_PARTIES;
  const results = [], csv = ["party,equipment,floor,seed,won,timedOut,seconds,hpRatio,survivors,enemyHpRatio,firstPlayerDeathSeconds,ultimateHitEvents"];
  for (const reference of references) for (const loadout of (equipment ? [equipment] : ["bare", "epic", "ceiling"]) as AncientEquipment[]) {
    const party = ancientReferenceParty(reference.relics, loadout, level, bondLevel), floors = [];
    for (let floor = onlyFloor ?? 1; floor <= (onlyFloor ?? 200); floor += quick ? 5 : 1) {
      const runs = seeds.map(seed => simulateAncientStrataRun(floor, party, seed, control as DifficultyControl, step));
      for (const run of runs) csv.push([reference.id, loadout, floor, run.seed, run.won, run.timedOut, run.seconds.toFixed(4), run.playerHpRatio.toFixed(6), run.survivors, run.enemyHpRatio.toFixed(6), run.firstPlayerDeathSeconds?.toFixed(4) ?? "", run.ultimateHitEvents].join(","));
      floors.push({ floor, winRate: runs.filter(run => run.won).length / runs.length, timeouts: runs.filter(run => run.timedOut).length,
        meanSeconds: runs.reduce((sum, run) => sum + run.seconds, 0) / runs.length,
        meanHp: runs.reduce((sum, run) => sum + run.playerHpRatio, 0) / runs.length });
    }
    let stableThrough = 0;
    for (const row of floors) { if (row.winRate < 0.8) break; stableThrough = row.floor; }
    const sequential = !quick && onlyFloor === undefined;
    const row = { id: reference.id, relics: reference.relics, equipment: loadout, level, breakthrough: Object.values(party.breakthroughs)[0], bondLevel,
      stableThrough: sequential ? stableThrough : null, sampledStableThrough: stableThrough,
      firstUnstableFloor: sequential && stableThrough < 200 ? stableThrough + 1 : null,
      reboundFloors: sequential ? floors.filter(row => row.floor > stableThrough + 1 && row.winRate >= 0.8).map(row => row.floor) : [],
      highestAnyWin: Math.max(0, ...floors.filter(row => row.winRate > 0).map(row => row.floor)),
      loadout: party.equipped, playerStats: party.players.map(p => ({ id: p.id, stats: p.stats })), floors };
    results.push(row); console.log(`${reference.id} ${loadout}: ${sequential ? "stable" : "sampled"}=${stableThrough}, highest=${row.highestAnyWin}`);
  }
  const output = values.get("--output") ?? "work/ancient-strata-audit.json";
  const csvPath = output.replace(/\.json$/i, "") + ".runs.csv";
  const report = { version: 1, sampled: quick, onlyFloor: onlyFloor ?? null, seeds, tickSeconds: step, timeLimitSeconds: 90, control,
    battleCount: csv.length - 1, recovery: "Full HP/energy/ferocity reset each floor; no expedition augments", rawRunsFile: csvPath.split("/").at(-1), results,
    definitions: Array.from({ length: 200 }, (_, index) => getAncientStrataFloor(index + 1)).map(({ enemies, ...floor }) => ({ ...floor, enemies: enemies.map(e => ({ id: e.id, role: e.encounterRole, stats: e.stats })) })) };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(csvPath, csv.join("\n") + "\n"); console.log(`Ancient strata audit saved: ${output}; battles=${report.battleCount}`);
}
