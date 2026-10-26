import type { EncounterRole } from "../core/levelDesign";

export type AncientEncounterKind = "normal" | "swarm" | "elite" | "eliteDuo" | "mixed";
export interface AncientEncounterTemplate {
  id: string;
  kind: AncientEncounterKind;
  rosters: readonly (readonly string[])[];
  hpBudget: number;
  attackBudget: number;
  defenseBudget: number;
}

/** 열 층 안에 조우를 교차 배치한다. 다음 구간은 다른 명단/시련으로 이어진다. */
export const ANCIENT_ENCOUNTERS: readonly AncientEncounterTemplate[] = [
  { id: "frontline", kind: "normal", rosters: [["amo","toby","ripa"],["atra","mir","neuri"],["amo","pulsi","neuri"],["atra","ikanixia","ripa"]], hpBudget: .91, attackBudget: 1, defenseBudget: 1 },
  { id: "surround", kind: "swarm", rosters: [["toby","pulsi","ripa","toby","ripa"],["ikanixia","mir","pulsi","neuri","pulsi"],["mir","toby","pulsi","ripa","mir"],["ikanixia","pulsi","mir","neuri","ikanixia"]], hpBudget: 1, attackBudget: 1, defenseBudget: .9 },
  { id: "hunter", kind: "elite", rosters: [["pulsi"],["koma"],["toby"],["ikanixia"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
  { id: "supply", kind: "normal", rosters: [["amo","ikanixia","neuri"],["atra","toby","ripa"],["amo","mir","neuri"],["atra","pulsi","ripa"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
  { id: "pincer", kind: "eliteDuo", rosters: [["toby","pulsi"],["koma","ikanixia"],["mir","toby"],["pulsi","ikanixia"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
  { id: "attrition", kind: "swarm", rosters: [["atra","toby","ripa","pulsi","ikanixia"],["amo","mir","neuri","ikanixia","pulsi"],["atra","pulsi","neuri","mir","ripa"],["amo","toby","ripa","pulsi","mir"]], hpBudget: 1, attackBudget: 1, defenseBudget: .9 },
  { id: "escort", kind: "mixed", rosters: [["koma","toby","ripa"],["pulsi","amo","neuri"],["ikanixia","atra","ripa"],["mir","amo","neuri"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
  { id: "crossfire", kind: "normal", rosters: [["ikanixia","pulsi","neuri"],["mir","toby","ripa"],["pulsi","ikanixia","ripa"],["toby","mir","neuri"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
  { id: "duel", kind: "eliteDuo", rosters: [["mir","ikanixia"],["toby","koma"],["pulsi","mir"],["ikanixia","toby"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
  { id: "gate", kind: "elite", rosters: [["koma"],["mir"],["ikanixia"],["pulsi"]], hpBudget: 1, attackBudget: 1, defenseBudget: 1 },
];

export type AncientTrialId = "endurance" | "armor" | "assault" | "deadline" | "shield" | "charge";
export const ANCIENT_TRIAL_IDS: readonly AncientTrialId[] = ["endurance","armor","assault","deadline","shield","charge"];
export const ANCIENT_TRIALS = {
  endurance: { hp: 1.1, attack: 1, defense: 1, seconds: 90 },
  armor: { hp: 1, attack: 1, defense: 1.2, seconds: 90 },
  assault: { hp: 1, attack: 1.1, defense: 1, seconds: 90 },
  deadline: { hp: .88, attack: 1, defense: 1, seconds: 60 },
  shield: { hp: 1, attack: 1, defense: 1, seconds: 90 },
  charge: { hp: 1, attack: 1, defense: 1, seconds: 90 },
} as const;

export function ancientEncounterRole(kind: AncientEncounterKind, index: number): EncounterRole {
  return kind === "swarm" ? "swarm" : kind === "elite" || kind === "eliteDuo" || kind === "mixed" && index === 0 ? "elite" : "normal";
}
