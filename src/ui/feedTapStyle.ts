/**
 * 급여 한 번의 손맛 — 값만 두는 순수 표다(`feedTapEffect.ts`가 그린다).
 *
 * 급여는 게임에서 가장 자주 두드리는 버튼이라 **연타가 곧 재미**여야 한다. 누를 때마다 치즈케이크
 * 한 조각이 톡 튀어 오르고, 이어 누를수록 연속 표시(×N)가 한 박자씩 커진다. 모양은 화면 전체의
 * 문법을 지킨다 — 반짝이는 조각은 동그라미가 아니라 **어긋나게 깎은 마름모**이고, 발밑으로
 * 쏟지 않고 **위로** 뜬다. 난수를 쓰지 않아 같은 연타가 늘 같은 그림을 그린다.
 */
export const FEED_TAP = {
  /** 튀어 오르는 치즈케이크 한 조각. */
  cake: {
    size: 58,
    rise: 150,
    /** 연타마다 좌우로 번갈아 비껴 뜨는 폭. 한 줄로만 오르면 조각이 겹쳐 하나로 보인다. */
    drift: [-46, 38, -22, 52, -58, 24] as readonly number[],
    tilt: 0.42,
    ms: 560,
  },
  /** 조각 둘레에 반짝이는 작은 마름모. 셋을 넘기지 않는다 — 연타 중에 화면이 조각으로 덮인다. */
  sparkle: { count: 3, size: 11, reach: 64, ms: 420, color: 0xffe08a },
  /** 동시에 떠 있는 조각의 상한. 넘치면 조용히 버린다 — 놓친 한 조각보다 끊긴 프레임이 크게 보인다. */
  maxLiveCakes: 7,
  /** 연속 표시(×N). 이 수부터 서고, 누르지 않은 지 이만큼 지나면 끊긴다. */
  combo: { from: 2, resetMs: 900, punch: 1.32, punchMs: 170, size: 34 },
  /** 손을 떼고 이만큼 쉬면 여러 레벨을 채우는 쪽지를 연다. 연타하는 동안에는 열지 않는다. */
  bulkIdleMs: 700,
} as const;

/** 연속 몇 번째인지로 조각이 비껴 뜨는 폭. 순서를 되풀이해 난수 없이 흩어진다. */
export function feedTapDrift(streak: number): number {
  const table = FEED_TAP.cake.drift;
  return table[((streak % table.length) + table.length) % table.length];
}

/** 연속 표시가 서는지. 한 번만 누른 손에 ×1을 세우면 숫자가 아무것도 말하지 않는다. */
export function feedComboVisible(streak: number): boolean {
  return streak >= FEED_TAP.combo.from;
}
