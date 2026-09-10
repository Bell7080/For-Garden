import type { ResearchGrade } from "./gacha";
import type { SkirmishEvent } from "./skirmish";

/** 연구 결과 햅틱은 상위 희귀도인 SR부터 울리며, 회색과 R 결과는 일반 결과로 취급한다. */
export const RARE_EXCAVATION_GRADES: readonly ResearchGrade[] = ["SR", "SSR"];

/** 서버가 확정한 결과 중 하나라도 정적 희귀도 기준에 들면 결과 햅틱을 한 번만 요청한다. */
export function hasRareExcavationResult(grades: readonly ResearchGrade[]): boolean {
  return grades.some((grade) => RARE_EXCAVATION_GRADES.includes(grade));
}

/** 플레이어 카드가 준비되지 않음에서 준비됨으로 바뀌는 단 한 경계만 궁극기 햅틱으로 인정한다. */
export function isPlayerUltimateReadyTransition(previous: boolean, next: boolean, side: "player" | "enemy"): boolean {
  return side === "player" && !previous && next;
}

/**
 * 한 코어 스텝/궁극기 묶음에 실제 양수 피해가 하나라도 있으면 true를 한 번만 반환한다.
 * 호출자가 사건마다 진동하지 않고 묶음마다 한 번만 묻기 때문에 광역과 다단 히트가 자연스럽게 병합된다.
 */
export function hasMergedBattleHit(events: readonly SkirmishEvent[]): boolean {
  return events.some((event) => (event.kind === "attack" || event.kind === "summonHit") && event.amount > 0);
}
