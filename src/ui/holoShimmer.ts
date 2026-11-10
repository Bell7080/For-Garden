/**
 * 정보창의 홀로그램 결 — 오각형 능력치·유대 하트가 함께 쓰는 순수 값과 계산(Phaser 없음).
 *
 * 투영된 빛이라는 것을 세 가지로 말한다:
 * 1. **주사선** — 면 안쪽에만 가는 가로줄이 촘촘히 깔린다. 도형 밖으로 새지 않도록 마스크가 아니라
 *    도형과 가로줄의 교차 구간을 직접 구해 긋는다(기하 마스크는 컨테이너 이동·기울임을 물려받지 않는다).
 * 2. **훑는 빛띠** — 밝은 띠 하나가 아래에서 위로 천천히 지나간다.
 * 3. **일렁임** — 꼭짓점이 몇 픽셀 안에서 서로 다른 박자로 숨 쉰다. 값이 바뀐 것처럼 보이지 않게 아주 작게 둔다.
 *
 * 움직임 줄이기에서는 주사선만 남고 움직이지 않는다. 난수를 쓰지 않는다.
 */
export const HOLO_SHIMMER = {
  /** 주사선 간격(px)과 진하기. */
  scan: { gap: 6, alpha: 0.12 },
  /** 훑는 빛띠 — 한 바퀴 시간과 띠 두께(도형 높이에 대한 비율). */
  sweep: { periodMs: 2600, band: 0.16, alpha: 0.22 },
  /** 꼭짓점 일렁임 — 반지름 대비 최대 비율과 박자. */
  wobble: { ratio: 0.022, periodMs: 1900 },
  /** 전체 밝기의 숨 — 이 폭 안에서 오르내린다. */
  breathe: { min: 0.86, periodMs: 2300 },
} as const;

/** 점 목록(평평한 [x0, y0, x1, y1, …])의 도형이 높이 `y`에서 차지하는 가로 구간들. 볼록하지 않아도 된다. */
export function polygonSpans(flat: readonly number[], y: number): [number, number][] {
  const xs: number[] = [];
  const count = flat.length / 2;
  for (let i = 0; i < count; i += 1) {
    const ax = flat[i * 2];
    const ay = flat[i * 2 + 1];
    const bx = flat[((i + 1) % count) * 2];
    const by = flat[((i + 1) % count) * 2 + 1];
    // 반열린 구간으로 세어 꼭짓점이 두 번 잡히지 않게 한다.
    if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }
  xs.sort((a, b) => a - b);
  const spans: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
  return spans;
}

/** `index`번째 꼭짓점이 `timeMs`에 반지름을 몇 배로 쓰는지. 꼭짓점마다 박자가 어긋난다. */
export function holoWobble(index: number, timeMs: number): number {
  const { ratio, periodMs } = HOLO_SHIMMER.wobble;
  return 1 + Math.sin((timeMs / periodMs) * Math.PI * 2 + index * 2.1) * ratio;
}

/** 훑는 빛띠의 자리 — 0(아래)에서 1(위)로 흐르고 처음으로 돌아간다. */
export function holoSweepPhase(timeMs: number): number {
  const { periodMs } = HOLO_SHIMMER.sweep;
  return ((timeMs % periodMs) + periodMs) % periodMs / periodMs;
}

/** 전체 밝기의 숨. `breathe.min`~1 사이를 오간다. */
export function holoBreathe(timeMs: number): number {
  const { min, periodMs } = HOLO_SHIMMER.breathe;
  return min + (1 - min) * (0.5 + 0.5 * Math.sin((timeMs / periodMs) * Math.PI * 2));
}
