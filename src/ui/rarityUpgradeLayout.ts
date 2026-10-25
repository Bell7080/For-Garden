/**
 * 10연 마지막 칸이 SR에서 SSR로 한 번 더 오르는 깜짝 연출의 자리와 박자.
 *
 * Phaser를 읽지 않는 순수 표다 — 장면(`RarityUpgradeReveal`)과 회귀 테스트가 같은 값을 읽는다.
 * 시간은 전부 실제 시간(ms)이고 배속을 곱하지 않는다. 한 판에 한 번 있을까 말까 한 장면이라
 * 어느 배속에서나 같은 길이로 읽혀야 한다.
 */

export const RARITY_UPGRADE_SIZE = { width: 1080, height: 1920 } as const;

/** 카드 한 장의 자리와 크기. 화면 가운데에서 약간 위에 선다. */
export const RARITY_UPGRADE_CARD = { x: 540, y: 880, width: 520, height: 740, bevel: 96 } as const;

/**
 * 막의 길이. 앞쪽 셋은 "에이 SR이네~"를 만드는 시간이고, `ting`부터가 깜짝이다.
 *
 * - `settle`: 어둠이 깔리고 보라빛 SR 카드가 선다.
 * - `calm`: 카드가 숨 쉬며 머문다 — 여기서 손을 떼고 싶어지게 둔다.
 * - `hush`: 숨이 멎는다. 카드가 가라앉고 어둠이 한 번 더 깊어진다.
 * - `tremor`: 금이 번지며 카드가 떨린다(움직임 줄이기에서는 떨지 않고 금만 번진다).
 * - `ting`: 터지는 순간. 이 뒤로 SSR 글자가 서고 조각이 흩어진다.
 * - `hold`: SSR이 선 채로 머무는 시간. 누르면 곧바로 닫힌다.
 * - `leave`: 닫히는 시간.
 */
export const RARITY_UPGRADE_TIMELINE = {
  settle: 420,
  calm: 1300,
  hush: 900,
  tremor: 900,
  ting: 340,
  hold: 1500,
  leave: 260,
} as const;

/** 움직임 줄이기에서 앞의 막을 줄이는 배율. 터지는 순간의 길이는 줄이지 않는다. */
export const RARITY_UPGRADE_REDUCED_RATIO = 0.55;

/** 터진 뒤 이 시간이 지나기 전의 누름은 버린다 — 연타가 깜짝을 삼키지 않게 한다. */
export const RARITY_UPGRADE_TAP_LOCK_MS = 560;

/** 터지기 전(깜짝 전)의 총 길이. 이 안에서는 어떤 누름도 장면을 넘기지 못한다. */
export function risingDuration(reduced: boolean): number {
  const { settle, calm, hush, tremor } = RARITY_UPGRADE_TIMELINE;
  const front = settle + calm + hush + tremor;
  return reduced ? Math.round(front * RARITY_UPGRADE_REDUCED_RATIO) : front;
}

/** 장면 전체의 길이(누르지 않았을 때). */
export function totalDuration(reduced: boolean): number {
  const { ting, hold, leave } = RARITY_UPGRADE_TIMELINE;
  return risingDuration(reduced) + ting + hold + leave;
}
