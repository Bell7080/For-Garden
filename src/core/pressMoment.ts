/**
 * 리듬 판정에 쓰는 「손가락이 닿은 시각」. 포인터 핸들러는 메인 스레드가 비어야 깨어나므로, 프레임이 바쁜 기기에서는
 * `performance.now()`가 실제로 누른 때보다 수십 ms 늦다 — 슈테의 리듬 낚시에서 바늘이 누른 자리를 지나쳐 멈추던 원인이다.
 * DOM 사건의 `timeStamp`는 브라우저가 입력을 받은 시각이고 `performance.now()`와 같은 시간축을 쓴다. 다만 오래된
 * 브라우저는 다른 시간축(에포크 ms)을 쓰므로, 지금보다 미래이거나 너무 먼 과거면 믿지 않고 지금 시각을 쓴다.
 */
export const PRESS_TIMESTAMP_MAX_AGE_MS = 500;

export function pressMomentMs(event: { timeStamp?: number } | null | undefined, now: number = performance.now()): number {
  const stamp = event?.timeStamp;
  if (typeof stamp !== "number" || !Number.isFinite(stamp) || stamp <= 0) return now;
  const age = now - stamp;
  return age >= 0 && age <= PRESS_TIMESTAMP_MAX_AGE_MS ? stamp : now;
}

/**
 * 눈에 보이는 바늘과 실제 시각의 어긋남(ms) 중 **기기와 무관한 몫**. 손가락이 화면에 닿은 뒤 브라우저가 입력을 받기까지,
 * 그리고 그려진 화면이 합성·주사되어 눈에 닿기까지의 시간이다. 사람은 **보이는 바늘**에 맞춰 누르므로 그만큼 늘 늦게
 * 판정되던 것을 판정 시각에서 덜어 낸다. 프레임 간격 몫은 따로 더한다(`shutePressLagMs`).
 */
export const SHUTE_PRESS_LAG_MS = 30;

/** 프레임 간격으로 볼 수 있는 범위(ms) — 120Hz(8ms)부터 프레임이 크게 밀린 30fps 남짓까지. 밖의 값은 탭 전환 같은 일시 멈춤이다. */
export const FRAME_INTERVAL_RANGE_MS = { min: 6, max: 50 } as const;
/** 스스로 맞추는 보정값의 범위(ms). 음수는 「화면보다 먼저 누르는 손」이다. 판정 창을 통째로 넘지 않게 묶는다. */
export const SHUTE_TIMING_BIAS_RANGE_MS = { min: -40, max: 80 } as const;
/** 한 번의 누름이 보정값을 얼마나 움직이나 — 작을수록 한두 번의 실수에 흔들리지 않는다. */
export const SHUTE_TIMING_BIAS_RATE = 0.12;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** 프레임 간격의 이동 평균. 일시 멈춤(범위 밖)은 버린다. */
export function nextFrameInterval(previous: number, deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs < FRAME_INTERVAL_RANGE_MS.min || deltaMs > FRAME_INTERVAL_RANGE_MS.max) return previous;
  return previous + (deltaMs - previous) * 0.1;
}

/**
 * 판정 시각에서 덜어 낼 몫(ms). 바늘은 한 프레임에 한 번 그 프레임의 시각으로 그려지고 다음 그림까지 그 자리에 서
 * 있으므로, 눈에 닿는 바늘은 평균 한 프레임만큼 더 늦다 — 30fps(절전·낮음 품질)면 60fps보다 17ms 더 늦다. 고정 35ms만
 * 덜던 때는 프레임이 느린 기기에서 바늘이 누른 자리를 지나쳐 멈췄다. 여기에 기기마다 스스로 맞춘 보정값을 더한다.
 */
export function shutePressLagMs(frameIntervalMs: number, biasMs = 0): number {
  const frame = clamp(Number.isFinite(frameIntervalMs) ? frameIntervalMs : 1000 / 60, FRAME_INTERVAL_RANGE_MS.min, FRAME_INTERVAL_RANGE_MS.max);
  const bias = clamp(Number.isFinite(biasMs) ? biasMs : 0, SHUTE_TIMING_BIAS_RANGE_MS.min, SHUTE_TIMING_BIAS_RANGE_MS.max);
  return Math.max(0, SHUTE_PRESS_LAG_MS + frame + bias);
}

/**
 * 판정 시각이 칸 한가운데를 지난 가장 가까운 순간에서 얼마나 늦었나(ms, 늦으면 양수). 바늘은 삼각파로 오가므로 한
 * 왕복(`2 × sweepMs`) 안에서 가운데를 두 번 지난다 — 그 둘과 앞뒤 왕복 중 가장 가까운 것과 견준다.
 */
export function timingErrorMs(spec: { center: number; sweepMs: number }, elapsedMs: number): number {
  const period = spec.sweepMs * 2;
  if (!(period > 0) || !Number.isFinite(elapsedMs)) return 0;
  const base = Math.floor(elapsedMs / period) * period;
  let best = Number.POSITIVE_INFINITY;
  for (const cycle of [base - period, base, base + period]) {
    for (const at of [cycle + spec.center * spec.sweepMs, cycle + (2 - spec.center) * spec.sweepMs]) {
      const error = elapsedMs - at;
      if (Math.abs(error) < Math.abs(best)) best = error;
    }
  }
  return best;
}

/**
 * 리듬 게임의 자동 보정 — 사람은 칸 한가운데를 노리므로, 맞힌 누름들이 한가운데에서 한쪽으로 쏠린 만큼이 그 기기의
 * 입력·화면 지연이다. 맞힌 누름(`withinMs` 안)만 조금씩 반영하고 범위 안에 묶는다. 빗나간 누름은 노린 자리를 알 수
 * 없어 버린다.
 */
export function nextTimingBias(previous: number, errorMs: number, withinMs: number): number {
  const base = Number.isFinite(previous) ? previous : 0;
  if (!Number.isFinite(errorMs) || !(withinMs > 0) || Math.abs(errorMs) > withinMs) return base;
  return Math.round(clamp(base + errorMs * SHUTE_TIMING_BIAS_RATE, SHUTE_TIMING_BIAS_RANGE_MS.min, SHUTE_TIMING_BIAS_RANGE_MS.max) * 10) / 10;
}
