/**
 * 궁극기 충전이 화면에서 **굴러가는** 규칙.
 *
 * 충전은 값 자체가 계단이다 — 한 대 때릴 때마다 게이지가 26씩(코스트의 3할 가까이) 한 프레임에
 * 뛴다. 그 값을 그대로 그리면 카드의 어둠이 **번쩍번쩍 끊겨** 지금 얼마나 찼는지도, 쓴 뒤에
 * 0에서 다시 오르는지도 보이지 않는다. 배속을 올리면 그 계단이 더 성겨져 아예 읽히지 않는다.
 *
 * 그래서 표시값만 목표를 뒤쫓는다. 체력·야성과 같은 지수 추격이되 **초당 최소 속도**를 함께
 * 둔다 — 지수만으로는 끝자락이 한없이 느려져 "다 찼다"가 늦게 오고, 쓴 직후의 0으로 내려가는
 * 길도 흐지부지 남는다. 계산에는 절대 쓰지 않는다: 쓸 수 있는지는 언제나 코어의 실제 값이 정하고,
 * 이 값은 어둠이 걷히는 각도 하나만 정한다.
 */
export const ULTIMATE_CHARGE_MOTION = {
  /** 남은 거리에 곱하는 지수 추격 계수(초당). */
  ease: 9,
  /** 초당 최소 이동량(비율). 멀든 가깝든 이만큼은 움직여 끝자락이 멎지 않는다. */
  minPerSecond: 0.45,
  /** 이 차이보다 가까우면 목표에 붙인다. 부동소수점 꼬리로 매 프레임 다시 칠하지 않는다. */
  snap: 0.004,
} as const;

/**
 * 한 프레임만큼 목표로 굴린다. `motionFactor`가 0이면(저사양·모션 끔) 즉시 맞춘다.
 *
 * `deltaSeconds`는 **씬의 실제 시간**이다. 전투 배속을 곱하지 않는 이유는, 배속을 올린 화면일수록
 * 눈이 따라갈 시간이 필요하기 때문이다 — 목표는 배속만큼 빨리 차오르고 표시는 같은 속도로
 * 굴러, 3배속에서도 "지금 차는 중"이 보인다.
 */
export function stepUltimateCharge(shown: number, target: number, deltaSeconds: number, motionFactor = 1): number {
  const goal = clamp01(target);
  if (motionFactor === 0) return goal;
  const from = clamp01(shown);
  const gap = goal - from;
  if (Math.abs(gap) <= ULTIMATE_CHARGE_MOTION.snap) return goal;
  const seconds = Math.max(0, deltaSeconds);
  const eased = Math.abs(gap) * Math.min(1, seconds * ULTIMATE_CHARGE_MOTION.ease * motionFactor);
  const floor = seconds * ULTIMATE_CHARGE_MOTION.minPerSecond * motionFactor;
  // 목표를 지나치지 않는다 — 지나치면 다 찬 카드가 한 프레임 덜 찬 것으로 보였다가 되돌아온다.
  const move = Math.min(Math.abs(gap), Math.max(eased, floor));
  return clamp01(from + Math.sign(gap) * move);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
