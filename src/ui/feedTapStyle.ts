/**
 * 급여 한 번의 손맛 — 값만 두는 순수 표다(`feedTapEffect.ts`가 그린다).
 *
 * 급여는 게임에서 가장 자주 두드리는 버튼이라 **연타가 곧 재미**여야 한다. 누를 때마다 치즈케이크
 * 몇 조각이 **포물선을 그리며 흩뿌려지고 떨어지는 자리에서 팡 터진다** — 한 조각이 위로 쇽 날아가
 * 사라지던 때는 "먹였다"가 아니라 "하나 지나갔다"로 읽혔다. 한 번에 많이 먹일수록(1레벨·10레벨)
 * 조각도 그만큼 많이, 여러 물결로 터진다. 꾹 누르면 **점점 빨라지며** 다다닥 먹인다.
 *
 * 모양은 화면 전체의 문법을 지킨다 — 반짝이는 조각은 동그라미가 아니라 **어긋나게 깎은 마름모**이고,
 * 포물선의 끝도 출발점보다 **위**라 발밑으로 쏟아지지 않는다. 난수를 쓰지 않아 같은 연타가 늘 같은
 * 그림을 그린다.
 */
export const FEED_TAP = {
  /** 흩뿌려지는 치즈케이크 한 조각. */
  cake: {
    size: 46,
    /** 떨어지는 자리까지의 가로 폭. 조각마다 이 폭 안에서 부채꼴로 벌어진다. */
    reach: 150,
    /** 포물선 꼭대기의 높이(출발점 기준 위로). 조각마다 조금씩 어긋난다. */
    peak: 120,
    peakStep: 26,
    /** 떨어지는 자리는 출발점보다 이만큼 위다 — 발밑으로 쏟지 않는다. */
    land: 36,
    spin: 1.6,
    ms: 520,
  },
  /** 한 번에 흩뿌리는 조각 수 — 한 번 누름 · 1레벨 · 10레벨. 많이 먹일수록 많이 터진다. */
  pieces: { tap: 3, level: 12, tenLevels: 28 },
  /** 한 물결에 띄우는 조각 수와 물결 사이 간격. 한꺼번에 스물을 띄우면 한 덩어리로 뭉친다. */
  wave: { size: 7, gapMs: 110 },
  /** 떨어진 자리에서 터지는 작은 마름모. 셋을 넘기지 않는다 — 연타 중에 화면이 조각으로 덮인다. */
  sparkle: { count: 3, size: 10, reach: 46, ms: 360, color: 0xffe08a },
  /** 동시에 떠 있는 조각의 상한. 넘치면 조용히 버린다 — 놓친 한 조각보다 끊긴 프레임이 크게 보인다. */
  maxLiveCakes: 30,
  /** 연속 표시(×N). 이 수부터 서고, 누르지 않은 지 이만큼 지나면 끊긴다. */
  combo: { from: 2, resetMs: 900, punch: 1.32, punchMs: 170, size: 34 },
  /**
   * 꾹 눌렀을 때 되풀이해 먹이는 간격. 처음은 두드리는 손보다 조금 느리고, 한 번 먹일 때마다
   * `accel`만큼 줄어 `minMs`에서 멈춘다 — 2초쯤 누르면 다다닥 최고 속도에 닿는다.
   */
  hold: { startMs: 200, minMs: 45, accel: 0.86 },
  /** 손을 떼고 이만큼 쉬면 여러 레벨을 채우는 쪽지를 연다. 연타하는 동안에는 열지 않는다. */
  bulkIdleMs: 700,
} as const;

/** 꾹 누른 채 `repeat`번째로 먹일 때까지의 간격(ms). 점점 빨라져 하한에서 멈춘다. */
export function feedHoldDelay(repeat: number): number {
  const { startMs, minMs, accel } = FEED_TAP.hold;
  return Math.max(minMs, Math.round(startMs * accel ** Math.max(0, repeat)));
}

/** 연속 몇 번째인지로 부채꼴을 비트는 폭. 순서를 되풀이해 난수 없이 흩어진다. */
const DRIFT = [-0.18, 0.14, -0.08, 0.2, -0.22, 0.1] as const;
export function feedTapDrift(streak: number): number {
  return DRIFT[((streak % DRIFT.length) + DRIFT.length) % DRIFT.length];
}

/**
 * 한 조각의 포물선 — 떨어지는 자리(`dx`·`dy`, 출발점 기준)와 꼭대기 높이(`peak`).
 *
 * `count`개가 좌우 부채꼴로 고르게 벌어지고, 연속 수(`streak`)만큼 부채꼴을 비틀어 이어 누른 조각이
 * 같은 자리에 겹치지 않는다. 가운데 조각일수록 높이 솟는다.
 */
export function feedBurstPath(index: number, count: number, streak = 0): { dx: number; dy: number; peak: number } {
  const { reach, peak, peakStep, land } = FEED_TAP.cake;
  const spread = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
  const lean = Math.max(-1, Math.min(1, spread + feedTapDrift(streak)));
  return {
    dx: Math.round(lean * reach),
    dy: -land - (index % 3) * 14,
    peak: peak + ((index * 7) % 4) * peakStep - Math.round(Math.abs(lean) * peakStep),
  };
}

/** 포물선 위 한 점. `t`는 0(출발)~1(착지)이다. */
export function feedArcPoint(path: { dx: number; dy: number; peak: number }, t: number): { x: number; y: number } {
  return { x: path.dx * t, y: path.dy * t - path.peak * 4 * t * (1 - t) };
}

/** 연속 표시가 서는지. 한 번만 누른 손에 ×1을 세우면 숫자가 아무것도 말하지 않는다. */
export function feedComboVisible(streak: number): boolean {
  return streak >= FEED_TAP.combo.from;
}
