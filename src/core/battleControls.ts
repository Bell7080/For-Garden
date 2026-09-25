/**
 * 플레이어가 순환할 수 있는 고정 전투 배속이다. 임의 배율은 리플레이 시간축을 복잡하게 만든다.
 *
 * **1 → 1.5 → 2가 누구에게나 열린 줄이고, 3배속은 멤버십 전용이다**(`MEMBER_BATTLE_SPEEDS`).
 * 멤버십 여부는 서버 시각으로만 정해지는 `adFreeMembership` 하나를 읽는다 — 던전의 x3 배율을
 * 잠그는 것과 같은 값이라, 두 곳이 서로 다른 "유료"를 말하지 않는다.
 */
export const BATTLE_SPEEDS = [1, 1.5, 2, 3] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];

/** 멤버십 없이 순환하는 배속. */
export const FREE_BATTLE_SPEEDS: readonly BattleSpeed[] = [1, 1.5, 2];
/** 멤버십이 있어야 열리는 배속. */
export const MEMBER_BATTLE_SPEEDS: readonly BattleSpeed[] = [3];

/** 지금 이 사람이 고를 수 있는 배속들. */
export function availableBattleSpeeds(member: boolean): readonly BattleSpeed[] {
  return member ? BATTLE_SPEEDS : FREE_BATTLE_SPEEDS;
}

/**
 * 저장된 배속을 지금 쓸 수 있는 값으로 맞춘다.
 *
 * 멤버십이 끝난 뒤에도 저장에 3이 남아 있을 수 있다. 그때는 1로 떨구지 않고 **열린 것 중 가장
 * 빠른 값**으로 내린다 — 멤버십이 끝났다고 전투가 갑자기 1배속이 되면 손이 먼저 놀란다.
 */
export function usableBattleSpeed(speed: BattleSpeed, member: boolean): BattleSpeed {
  const open = availableBattleSpeeds(member);
  if (open.includes(speed)) return speed;
  return [...open].reverse().find((value) => value <= speed) ?? open[0];
}

/** 열린 배속 줄의 다음 값. 마지막 다음은 다시 1배속이다. */
export function nextBattleSpeed(current: BattleSpeed, member: boolean): BattleSpeed {
  const open = availableBattleSpeeds(member);
  const index = open.indexOf(usableBattleSpeed(current, member));
  return open[(index + 1) % open.length];
}

/**
 * 배속 칩이 켜진 연출을 얼마나 세게 두르나. 1배속은 꺼진 상태(0)이고 단계가 오를수록 강하다.
 * 칩은 이 수만 읽고 배속 값을 다시 해석하지 않는다.
 */
export function battleSpeedTier(speed: BattleSpeed): 0 | 1 | 2 | 3 {
  return speed >= 3 ? 3 : speed >= 2 ? 2 : speed > 1 ? 1 : 0;
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
/**
 * **모든 전투는 전원이 서고 나서 잠깐 숨을 고른 뒤 시작한다**(실제 시간, 배속과 무관).
 * SD와 체력 바가 서는 그 프레임에 곧바로 시간을 흘리던 때는 전장을 한 번 훑어볼 틈도 없이
 * 양쪽이 부딪혀 어지럽게 읽혔다. 배속을 곱하지 않는 이유는 이 틈이 전투가 아니라 **보는 사람의
 * 몫**이기 때문이다 — 3배속을 켠 손도 전장이 어떻게 섰는지는 한 번 본다.
 */
export const BATTLE_OPENING_HOLD_MS = 900;

/** 전원이 선 시각에서 전투가 실제로 흐르기 시작하는 시각. */
export function battleFightStartsAt(spawnedAt: number): number {
  return spawnedAt + BATTLE_OPENING_HOLD_MS;
}

export const ULTIMATE_MIN_DURATION_MS = 24;
/** 진입·이름 노출·퇴장을 합쳐 두세 프레임짜리 섬광으로 축소되지 않게 하는 컷인 전체 하한이다. */
export const ULTIMATE_CUT_IN_MIN_VISIBLE_MS = 96;
export const ULTIMATE_RECOVERY_RATIO = 0.55;

/**
 * 궁극기 사건을 모두 전달한 뒤 화면 연출을 더 기다릴지 정한다.
 *
 * finish는 공격 판정이 이미 끝났다는 코어의 선언이다. 따라서 결정타에서는 공격 Puppet과
 * 확대 복귀가 결과 UI를 막지 않고, 사망 트윈만 독립적인 배경 시각 효과로 남는다.
 */
export function shouldWaitForUltimatePresentation(hasDeathEvent: boolean, hasFinishEvent: boolean): boolean {
  return !(hasDeathEvent && hasFinishEvent);
}

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

/** 세 구간의 상대 속도는 유지하되 부족한 전체 가시 시간은 이름을 읽는 가운데 hold에 더한다. */
export function scaleUltimateCutInDurations(
  enterMs: number, holdMs: number, exitMs: number, timing: UltimatePresentationTiming,
): readonly [enter: number, hold: number, exit: number] {
  if (timing.skipLeadIn) return [0, 0, 0];
  const durations = [enterMs, holdMs, exitMs].map((duration) => scaleUltimateDuration(duration, timing));
  const deficit = Math.max(0, ULTIMATE_CUT_IN_MIN_VISIBLE_MS - durations.reduce((sum, duration) => sum + duration, 0));
  return [durations[0], durations[1] + deficit, durations[2]];
}
