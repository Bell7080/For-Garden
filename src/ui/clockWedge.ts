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
