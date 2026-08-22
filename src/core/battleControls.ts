/** 플레이어가 순환할 수 있는 고정 전투 배속이다. 임의 배율은 리플레이 시간축을 복잡하게 만든다. */
export const BATTLE_SPEEDS = [1, 2, 3] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];

/** 마지막 3배속 다음에는 다시 1배속으로 돌아간다. */
export function nextBattleSpeed(current: BattleSpeed): BattleSpeed {
  const index = BATTLE_SPEEDS.indexOf(current);
  return BATTLE_SPEEDS[(index + 1) % BATTLE_SPEEDS.length];
}
