/** 플레이어가 순환할 수 있는 고정 전투 배속이다. 임의 배율은 리플레이 시간축을 복잡하게 만든다. */
export const BATTLE_SPEEDS = [1, 2, 3] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];

/** 마지막 3배속 다음에는 다시 1배속으로 돌아간다. */
export function nextBattleSpeed(current: BattleSpeed): BattleSpeed {
  const index = BATTLE_SPEEDS.indexOf(current);
  return BATTLE_SPEEDS[(index + 1) % BATTLE_SPEEDS.length];
}

/** 궁극기만의 화면 연출 시간축이다. 코어 전투 시간에는 절대로 전달하지 않는다. */
export interface UltimatePresentationTiming {
  /** 컷인·확대·공격 Puppet이 함께 쓰는 재생 배율이다. */
  rate: number;
  /** 스킵은 사건을 없애지 않고, 공격 전 기다림만 없앤다. */
  skipLeadIn: boolean;
}

const ULTIMATE_BASE_RATE = 2.25;
const ULTIMATE_RATE_CAP = 3.25;
export const ULTIMATE_MIN_DURATION_MS = 24;
export const ULTIMATE_RECOVERY_RATIO = 0.55;

/**
 * 1배속부터 기존 공격 배율 2보다 빠른 2.25를 써 반복 궁극기의 정체감을 줄인다.
 * 2·3배속은 3.25에서 막는다. 그 이상은 관절 보간이 건너뛰어져 공격이 순간이동처럼 보인다.
 */
export function ultimatePresentationTiming(battleSpeed: BattleSpeed, skipLeadIn: boolean): UltimatePresentationTiming {
  return { rate: Math.min(ULTIMATE_BASE_RATE * battleSpeed, ULTIMATE_RATE_CAP), skipLeadIn };
}

/** 프리셋의 상대적인 무게감은 보존하면서 공용 시간축과 최소 한 프레임가량의 가시성을 적용한다. */
export function scaleUltimateDuration(durationMs: number, timing: UltimatePresentationTiming, ratio = 1): number {
  if (timing.skipLeadIn) return 0;
  return Math.max(ULTIMATE_MIN_DURATION_MS, Math.round((durationMs * ratio) / timing.rate));
}
