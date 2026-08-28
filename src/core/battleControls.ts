/** 플레이어가 순환할 수 있는 고정 전투 배속이다. 임의 배율은 리플레이 시간축을 복잡하게 만든다. */
export const BATTLE_SPEEDS = [1, 2, 3] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];

/** 마지막 3배속 다음에는 다시 1배속으로 돌아간다. */
export function nextBattleSpeed(current: BattleSpeed): BattleSpeed {
  const index = BATTLE_SPEEDS.indexOf(current);
  return BATTLE_SPEEDS[(index + 1) % BATTLE_SPEEDS.length];
}

/**
 * 궁극기 연출이 전투 배속에서 받아 가는 몫.
 *
 * 전투 진행은 배속만큼 그대로 빨라지지만 연출까지 같은 배율로 당기면 컷인이 눈에 남지 않고
 * 지나가 버린다. 연출은 "누가 무엇을 쓰는가"를 읽히게 하는 것이 목적이라, 배속의 20%만
 * 받아 3배속에서도 1.4배까지만 빨라진다.
 */
export const ULTIMATE_PRESENTATION_SPEED_SHARE = 0.2;

export function ultimatePresentationSpeed(speed: BattleSpeed): number {
  return 1 + (speed - 1) * ULTIMATE_PRESENTATION_SPEED_SHARE;
}
