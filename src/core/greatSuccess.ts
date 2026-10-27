/**
 * **대성공** — 던전(치즈케이크 대작전·현상수배) 한 판을 이겼을 때 가끔 보상이 한 번 더 얹히는 규칙.
 *
 * 판마다 서버가 따로 굴린다 — 소탕 열 번이면 열 번 굴린다. 화면은 굴리지 않고 서버가 확정한
 * 횟수(`greatSuccessCount`)와 얹힌 몫(`greatSuccessBonus`)만 그린다.
 *
 * **배율은 1.5배다.** 2배로 두면 대성공 한 판의 보상이 「반복 수급처의 1회 보상을 2배 이상」 승인선에
 * 닿는다(CLAUDE.md 반복 보상 인플레이션). 1.5배는 기대 공급량을 +5%(10% × 0.5)만 올려 그 선의 한참
 * 아래에 머물면서, 숫자가 눈에 띄게 오르는 맛은 남긴다. 대상은 판의 기본 보상(재화)뿐이고 초회
 * 해금·덤(토벌권)은 건드리지 않는다.
 */
export const GREAT_SUCCESS = {
  /** 한 판이 대성공일 확률. */
  chance: 0.1,
  /** 대성공 판이 받는 기본 보상의 배율. 얹히는 몫은 `multiplier - 1`이다. */
  multiplier: 1.5,
} as const;

/** 난수 하나로 한 판의 대성공을 판정한다. */
export function rollGreatSuccess(random: () => number): boolean {
  return random() < GREAT_SUCCESS.chance;
}

/** `runs`판 중 대성공 판 수. 판마다 난수를 하나씩 쓴다. */
export function rollGreatSuccessCount(runs: number, random: () => number): number {
  let count = 0;
  for (let index = 0; index < runs; index += 1) if (rollGreatSuccess(random)) count += 1;
  return count;
}

/**
 * 대성공 `count`판이 얹는 몫 — 한 판 보상의 `multiplier - 1`배를 판 수만큼. 재화마다 내림한다
 * (반올림하면 1짜리 보상이 대성공마다 1을 더 받아 배율이 2배가 된다). 0인 재화는 싣지 않는다.
 */
export function greatSuccessBonus(rewards: Readonly<Record<string, number>>, count: number): Record<string, number> {
  if (count <= 0) return {};
  const extra = GREAT_SUCCESS.multiplier - 1;
  return Object.fromEntries(Object.entries(rewards)
    .map(([currency, amount]) => [currency, Math.floor(amount * extra) * count] as const)
    .filter(([, amount]) => amount > 0));
}

/** 소탕 영수증이 판을 몇 번 쾅 울릴지 — 너무 많으면 기다림이 되므로 다섯에서 멈춘다. */
export const GREAT_SUCCESS_MAX_PULSES = 5;

export function greatSuccessPulses(count: number): number {
  return Math.max(0, Math.min(GREAT_SUCCESS_MAX_PULSES, Math.floor(count)));
}
