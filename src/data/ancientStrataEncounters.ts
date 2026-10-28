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

export interface AncientTrial {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly seconds: number;
  /** 적 전원이 최대 체력의 몇 %만큼 막을 두르고 시작하나. */
  readonly initialShieldPercent?: number;
  /** 적 전원의 궁극기 게이지가 몇 % 찬 채로 시작하나. */
  readonly openingEnergyPercent?: number;
  /** 적 전원의 공격 속도가 몇 % 오르나(곱셈 — 원정 증강 `attackSpeedPercent`와 같은 길). 공격 예산을 맞춘 **뒤에** 얹는다. */
  readonly attackSpeedPercent?: number;
  /** 적 전원의 치명타 확률에 몇 %를 더하나(덧셈 — `flatStat critChance`와 같은 길). */
  readonly critChancePoints?: number;
}
export type AncientTrialId = "endurance" | "armor" | "assault" | "deadline" | "shield" | "charge" | "frenzy" | "precision";
export const ANCIENT_TRIAL_IDS: readonly AncientTrialId[] = ["endurance","armor","assault","deadline","shield","charge","frenzy","precision"];
/** 시련 하나가 판을 얼마나 바꾸는가(2026-10-27 상향 — 체력·공격 +30%, 방어 +50%, 막 30%, 궁극기 50%, 시한 45초 · 2026-10-28 공속 +25%·치명타 +30% 추가). */
export const ANCIENT_TRIALS = {
  endurance: { hp: 1.3, attack: 1, defense: 1, seconds: 90 },
  armor: { hp: 1, attack: 1, defense: 1.5, seconds: 90 },
  assault: { hp: 1, attack: 1.3, defense: 1, seconds: 90 },
  deadline: { hp: .88, attack: 1, defense: 1, seconds: 45 },
  shield: { hp: 1, attack: 1, defense: 1, seconds: 90, initialShieldPercent: 30 },
  charge: { hp: 1, attack: 1, defense: 1, seconds: 90, openingEnergyPercent: 50 },
  // 2026-10-28 응태 요청 — 공속 +25%는 평타 압박을 맹공(+30%)보다 조금 덜 올린다(궁극기 충전도 함께 빨라지므로).
  // 치명타 +30%는 기본 10% → 40%라 평균 피해 기대치가 ×1.05 → ×1.20(약 +14%)이고, 한 방의 흔들림이 시련의 몫이다.
  frenzy: { hp: 1, attack: 1, defense: 1, seconds: 90, attackSpeedPercent: 25 },
  precision: { hp: 1, attack: 1, defense: 1, seconds: 90, critChancePoints: 30 },
} as const satisfies Record<AncientTrialId, AncientTrial>;

export function ancientEncounterRole(kind: AncientEncounterKind, index: number): EncounterRole {
  return kind === "swarm" ? "swarm" : kind === "elite" || kind === "eliteDuo" || kind === "mixed" && index === 0 ? "elite" : "normal";
}
