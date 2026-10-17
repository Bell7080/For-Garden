import type { Combatant } from "./combatTypes";

/** 스킬별 비용과 별도로 전투원이 저장할 수 있는 궁극기 게이지 상한이다. */
// 스피나의 300 비용을 지원한다. UI는 비용을 분모로 쓰므로 기존 캐릭터 충전 시간은 변하지 않는다.
export const ULTIMATE_ENERGY_MAX = 300;

/**
 * 그 전투원이 쌓아 둘 수 있는 게이지의 끝. **자기 궁극기 비용까지만** 찬다 — 전역 상한(300)까지 쌓게 두면 비용 100인
 * 개체가 수동 모드나 기절·광란으로 쏘지 못하는 동안 보이지 않는 게이지를 두 번 몫 더 모았다가 연달아 쏜다
 * (화면의 게이지는 비용에서 가득 차 보여 초과분이 읽히지 않는다).
 */
export function ultimateEnergyCap(unit: Combatant): number {
  return Math.min(ULTIMATE_ENERGY_MAX, unit.def.ultimate.cost);
}

/** 생존 중이며 자신의 스킬 비용을 모은 전투원만 궁극기를 사용할 수 있다. */
export function canUseUltimate(unit: Combatant): boolean {
  return unit.hp > 0 && unit.energy >= unit.def.ultimate.cost;
}
