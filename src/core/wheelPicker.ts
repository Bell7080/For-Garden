/**
 * 시간 고르기 바퀴(드럼)의 순수 규칙 — 타이머를 맞추듯 위아래로 굴려 고른다.
 *
 * 바퀴는 **끝이 없다**(23시 다음이 0시). 끝에서 멈추면 23시를 고르러 온 손이 거꾸로 스물세 칸을 굴려야
 * 한다. 위치는 실수(칸 단위)로 들고, 손을 떼면 가장 가까운 칸에 붙는다 — 빠르게 튕기면 그 속도만큼
 * 더 굴러간 뒤 붙는다.
 */

/** 음수까지 받아 0 ~ count-1로 접는다. */
export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

/**
 * 손을 뗀 자리에서 멈출 칸.
 *
 * `velocity`는 칸/초이고 굴리는 방향이 양수다. 튕긴 만큼 `glide`초 동안 더 굴러간다고 보고 그 끝에서
 * 가장 가까운 칸으로 붙인다. 한 번에 너무 멀리 가면 원하는 칸을 지나쳐 버리므로 `maxSpin`칸에서 자른다.
 */
export function wheelSnapTarget(position: number, velocity: number, glide = 0.18, maxSpin = 8): number {
  const spin = Math.max(-maxSpin, Math.min(maxSpin, velocity * glide));
  return Math.round(position + spin);
}

/** 바퀴 위 한 칸이 가운데에서 떨어진 거리(칸)에 따라 옅어지고 작아진다. 가운데가 1이다. */
export function wheelSlotStyle(offset: number, visibleHalf = 2.5): { alpha: number; scale: number } {
  const distance = Math.min(Math.abs(offset), visibleHalf);
  const t = distance / visibleHalf;
  return { alpha: Math.max(0, 1 - t * t), scale: 1 - 0.28 * t };
}

/** `HH:MM` 목록을 시·분 두 바퀴로 가른다. 두 바퀴는 목록에 실제로 있는 값만 담는다. */
export function splitClockChoices(choices: readonly string[]): { hours: string[]; minutes: string[] } {
  const hours = new Set<string>();
  const minutes = new Set<string>();
  for (const choice of choices) {
    const [hour, minute] = choice.split(":");
    if (hour === undefined || minute === undefined) continue;
    hours.add(hour);
    minutes.add(minute);
  }
  return { hours: [...hours].sort(), minutes: [...minutes].sort() };
}

/** 두 바퀴가 가리키는 값. 목록에 없는 조합이면 가장 가까운 앞 값으로 되돌린다. */
export function joinClockChoice(choices: readonly string[], hour: string, minute: string): string {
  const joined = `${hour}:${minute}`;
  if (choices.includes(joined)) return joined;
  const earlier = [...choices].filter((choice) => choice <= joined).sort();
  return earlier[earlier.length - 1] ?? choices[0] ?? joined;
}
