import type { Combatant } from "./combatTypes";

/** 스킬별 비용과 별도로 전투원이 저장할 수 있는 궁극기 게이지 상한이다. */
// 스피나의 300 비용을 지원한다. UI는 비용을 분모로 쓰므로 기존 캐릭터 충전 시간은 변하지 않는다.
export const ULTIMATE_ENERGY_MAX = 300;

/** 생존 중이며 자신의 스킬 비용을 모은 전투원만 궁극기를 사용할 수 있다. */
export function canUseUltimate(unit: Combatant): boolean {
  return unit.hp > 0 && unit.energy >= unit.def.ultimate.cost;
}
