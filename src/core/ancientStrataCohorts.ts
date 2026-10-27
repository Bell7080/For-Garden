import { RELICS } from "../data/relics";
import type { RelicDef } from "./types";
import { ancientReferenceParty, simulateAncientStrataRun, type AncientEquipment } from "./ancientStrataSimulation";
import { ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";

export const ANCIENT_GROWTH_COHORTS = [
  { id: "sr50", level: 50, rarity: "SR" },
  { id: "sr40", level: 40, rarity: "SR" },
  { id: "ssr30", level: 30, rarity: "SSR" },
  { id: "mixed20", level: 20, rarity: "mixed" },
] as const;
export type AncientGrowthCohort = typeof ANCIENT_GROWTH_COHORTS[number];

/** 순서는 탱커/딜러/지원가. 소환수·적 전용·R 등급은 이번 코호트에서 제외한다. */
export function ancientRegularParties(cohort: AncientGrowthCohort, roster: readonly RelicDef[] = RELICS): [string, string, string][] {
  const candidates = roster.filter(r => !r.enemyOnly && !r.summonOnly && (cohort.rarity === "mixed" ? r.rarity === "SR" || r.rarity === "SSR" : r.rarity === cohort.rarity));
  const parties: [string, string, string][] = [];
  for (const tank of candidates.filter(r => r.role === "tank")) {
    for (const dealer of candidates.filter(r => r.role === "warrior" || r.role === "assassin")) {
      for (const support of candidates.filter(r => r.role === "support")) {
        if (cohort.rarity === "mixed" && new Set([tank.rarity, dealer.rarity, support.rarity]).size !== 2) continue;
        parties.push([tank.id, dealer.id, support.id]);
      }
    }
  }
  return parties;
}

/** 비단조 전투에서 이분 탐색하지 않는다. 첫 불안정 층까지 전부 재생하면 연속 안정 도달층은 확정된다. */
export function inspectAncientStableFrontier(ids: readonly string[], level: number, equipment: AncientEquipment, seeds: readonly number[], bondLevel = 10) {
  if (seeds.length === 0 || seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)) throw new RangeError("고정 시드는 uint32 한 개 이상입니다.");
  const party = ancientReferenceParty(ids, equipment, level, bondLevel);
  const floors = [];
  let stableThrough = 0;
  for (let floor = 1; floor <= ANCIENT_STRATA_MAX_FLOOR; floor++) {
    const runs = seeds.map(seed => simulateAncientStrataRun(floor, party, seed));
    const wins = runs.filter(run => run.won).length;
    floors.push({ floor, wins, runs });
    if (wins / seeds.length < 0.8) break;
    stableThrough = floor;
  }
  return { stableThrough, firstUnstableFloor: stableThrough < ANCIENT_STRATA_MAX_FLOOR ? stableThrough + 1 : null,
    breakthrough: Object.values(party.breakthroughs)[0], floors };
}
