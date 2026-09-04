/**
 * 시계 방향으로 덮이는 부채꼴을 **칩 사각형 안에서 잘라** 만든다.
 *
 * 기하 마스크를 쓰지 않는 이유는 룬 액자와 같다 — 마스크는 컨테이너 이동을 물려받지 않아
 * 매 프레임 자리를 옮기는 머리 위 칩에서 어긋난다. 그래서 원을 그려 가리는 대신, 부채꼴이
 * 사각형과 만나는 점을 직접 구해 **그 모양 그대로** 칠한다.
 *
 * 12시에서 시작해 시계 방향으로 `ratio`만큼 덮는다. 남은 시간이 아니라 **지나간 시간**을 덮어
 * 상태가 끝날수록 칩이 어두워진다 — 다 덮이는 순간이 곧 풀리는 순간이다.
 */
export interface WedgePoint { x: number; y: number }

/** 사각형(한 변 `size`)의 중심에서 각도 `theta`로 나간 반직선이 변에 닿는 점. */
function edgePoint(theta: number, half: number): WedgePoint {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // 두 축 중 먼저 변에 닿는 쪽이 배율을 정한다. 모서리에서는 둘이 같다.
  const reach = 1 / Math.max(Math.abs(cos), Math.abs(sin));
  return { x: cos * reach * half, y: sin * reach * half };
}

/** 12시에서 시계 방향으로 `ratio`(0~1)만큼 덮는 부채꼴의 폴리곤. 비어 있으면 빈 배열이다. */
export function clockWedgePoints(size: number, ratio: number): WedgePoint[] {
  const covered = Math.max(0, Math.min(1, ratio));
  if (covered <= 0) return [];
  const half = size / 2;
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * covered;
  const points: WedgePoint[] = [{ x: 0, y: 0 }, edgePoint(start, half)];
  // 지나가는 모서리를 그대로 넣어야 부채꼴이 사각형 모서리에서 잘려 보이지 않는다.
  for (let corner = -Math.PI * 3 / 4; corner < end + Math.PI * 2; corner += Math.PI / 2) {
    if (corner <= start) continue;
    if (corner >= end) break;
    points.push(edgePoint(corner, half));
  }
  points.push(edgePoint(end, half));
  return points;
}

/**
 * 칩 도형(깎인 네모) 안에서 잘라 만드는 부채꼴.
 *
 * 정사각형 기준으로 그리면 **깎인 모서리를 넘어 삐져나온다** — 칩의 오른쪽 아래는 빗변으로
 * 잘려 있어 그 밖으로 흘러내린 검은 조각이 바로 아래 체력 바를 가렸다. 그래서 덮는 도형도
 * 사각형이 아니라 **칩 폴리곤 자체**를 향해 쏘아 구한다.
 *
 * 칩은 볼록 다각형이라 중심에서 나간 반직선이 변과 정확히 한 번 만난다.
 */
export function clockWedgeOnShape(shape: readonly WedgePoint[], ratio: number): WedgePoint[] {
  const covered = Math.max(0, Math.min(1, ratio));
  if (covered <= 0 || shape.length < 3) return [];
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * covered;
  const points: WedgePoint[] = [{ x: 0, y: 0 }, shapeEdgePoint(start, shape)];
  // 지나가는 꼭짓점을 그대로 넣어야 부채꼴이 도형 모서리에서 잘려 보이지 않는다.
  for (const vertex of shape.map((point) => ({ point, angle: normalizeFrom(Math.atan2(point.y, point.x), start) }))
    .sort((a, b) => a.angle - b.angle)) {
    if (vertex.angle <= 0 || start + vertex.angle >= end) continue;
    points.push(vertex.point);
  }
  points.push(shapeEdgePoint(end, shape));
  return points;
}

/** `angle`을 `from` 기준의 0 이상 2π 미만 값으로 옮긴다. */
function normalizeFrom(angle: number, from: number): number {
  const delta = (angle - from) % (Math.PI * 2);
  return delta < 0 ? delta + Math.PI * 2 : delta;
}

/** 중심에서 각도 `theta`로 나간 반직선이 볼록 다각형의 변에 닿는 점. */
function shapeEdgePoint(theta: number, shape: readonly WedgePoint[]): WedgePoint {
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  let nearest = Infinity;
  for (let index = 0; index < shape.length; index += 1) {
    const a = shape[index];
    const b = shape[(index + 1) % shape.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denominator = ex * dy - ey * dx;
    if (Math.abs(denominator) < 1e-9) continue;
    const t = (a.y * dx - a.x * dy) / denominator;
    if (t < 0 || t > 1) continue;
    const distance = Math.abs(dx) > Math.abs(dy) ? (a.x + t * ex) / dx : (a.y + t * ey) / dy;
    if (distance > 0 && distance < nearest) nearest = distance;
  }
  // 볼록 도형이면 반드시 한 번은 만난다. 만나지 못하는 값이 들어오면 중심을 돌려 빈 도형이 된다.
  return Number.isFinite(nearest) ? { x: dx * nearest, y: dy * nearest } : { x: 0, y: 0 };
}
