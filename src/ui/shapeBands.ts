/**
 * 볼록한 판 실루엣(`chipPoints`)을 가로 띠로 잘라 내는 순수 계산.
 *
 * 그라데이션 빛을 네모(`fillGradientStyle` + `fillRect`)로 깔면 깎인 모서리 밖으로 빛이 새어
 * 뾰족한 뿔이 남는다. 같은 실루엣을 띠마다 잘라 칠하면 빛이 판 모양을 그대로 따른다.
 * 판 도형은 늘 볼록하므로 두 반평면으로 자르는 것(Sutherland–Hodgman)으로 충분하다.
 */
export function clipShapeBand(shape: readonly number[], top: number, bottom: number): number[] {
  let points: [number, number][] = [];
  for (let i = 0; i < shape.length; i += 2) points.push([shape[i], shape[i + 1]]);
  const clip = (keep: (y: number) => boolean, edge: number): void => {
    const out: [number, number][] = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const aIn = keep(a[1]);
      const bIn = keep(b[1]);
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (edge - a[1]) / (b[1] - a[1]);
        out.push([a[0] + (b[0] - a[0]) * t, edge]);
      }
    }
    points = out;
  };
  clip((y) => y >= top, top);
  clip((y) => y <= bottom, bottom);
  return points.flat();
}

/** 실루엣을 원점 기준으로 줄인 사본 — 안쪽으로 고이는 빛을 겹겹이 쌓을 때 쓴다. */
export function scaleShape(shape: readonly number[], factorX: number, factorY = factorX, offsetY = 0): number[] {
  return shape.map((value, index) => (index % 2 === 0 ? value * factorX : value * factorY + offsetY));
}
