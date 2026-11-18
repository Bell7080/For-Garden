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
 * 눈에 보이는 바늘과 실제 시각의 어긋남(ms). 화면에 그려진 바늘은 그려진 뒤 한두 프레임이 지나서야 눈에 닿고, 손가락이
 * 화면에 닿은 뒤 브라우저가 입력을 받기까지도 시간이 걸린다. 사람은 **보이는 바늘**에 맞춰 누르므로 그만큼 늘 늦게
 * 판정되던 것을 판정 시각에서 덜어 낸다. 판정 창(130ms 이상)의 3분의 1에 못 미치게 둔다.
 */
export const SHUTE_PRESS_LAG_MS = 35;
