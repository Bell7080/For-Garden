/**
 * 코어가 전달하는 표시 가능한 전투 메커니즘이다.
 *
 * 색·텍스처·애니메이션 이름을 넣지 않은 판별자라 Phaser가 없는 테스트와 서버 재현도 같은
 * 계약을 공유한다. `intensity`는 궁극기 같은 연출의 무게이며 메커니즘 종류와 섞지 않는다.
 */
export type CombatEffectTag =
  | "heal"
  | "shieldGain"
  | "shieldHit"
  | "shieldBreak"
  | "stealthEnter"
  | "stealthActive"
  | "stealthExit";

export interface CombatEffectCue {
  tag: CombatEffectTag;
  /** 1은 보통 연출이며 호출부가 명시한 큰 기술만 별도 배율을 쓴다. */
  intensity: number;
}

/** 갱신 전후의 실제 상태만으로 일회성 은신 전환을 만든다. 활성 상태의 연장은 진입이 아니다. */
export function stealthTransition(before: number, after: number): CombatEffectTag | undefined {
  if (before <= 0 && after > 0) return "stealthEnter";
  if (before > 0 && after <= 0) return "stealthExit";
  return undefined;
}

/** 보호막의 중첩·흡수·파괴를 양의 실제 변화만으로 판별한다. */
export function shieldTransition(before: number, after: number): CombatEffectTag | undefined {
  if (after > before) return "shieldGain";
  if (before > 0 && after <= 0) return "shieldBreak";
  if (before > after) return "shieldHit";
  return undefined;
}

/** 상한에 막힌 0 회복은 표시 사건을 만들지 않는다. */
export function healedAmount(before: number, after: number): number {
  return Math.max(0, after - before);
}
