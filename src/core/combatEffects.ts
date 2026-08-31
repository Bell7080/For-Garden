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
  | "stealthExit"
  /** 메테 자신의 크레셴도 스타카토 폭주가 유지되는 동안만 존재하는 순수 표시 상태다. */
  | "metteStaccatoActive"
  /** 루카와 같은 적을 겨누어 실제 공격 속도 오라를 받는 전투원의 순수 표시 상태다. */
  | "lukaSharedTargetHasteActive";

/**
 * 코어가 소유하는 유지 효과 식별자다. 표현 계층은 이 목록을 그대로 동기화할 뿐 지속 시간을
 * 추측하지 않는다. `id`는 제공자가 여럿인 오라도 서로 덮어쓰지 않게 하는 전투 내 안정 키다.
 */
export interface ActiveCombatDisplayEffect {
  id: string;
  tag: Extract<CombatEffectTag, "stealthActive" | "metteStaccatoActive" | "lukaSharedTargetHasteActive">;
  /** 루카 궤적처럼 방향을 표시해야 할 때만 코어의 실제 표적 전투원 ID를 전달한다. */
  aimTargetId?: string;
}

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
