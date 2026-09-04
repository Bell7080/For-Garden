/**
 * 채찍 한 줄의 **순수 도형**.
 *
 * 뿌리에서 끝으로 갈수록 가늘어지는 리본이라, 곧은 선 하나로는 만들 수 없고 양옆으로 폭을
 * 벌린 폴리곤이어야 한다. Phaser를 들여오지 않는 이유는 이 모양이 실제로 뿌리보다 끝이
 * 가늘고 도중에 스스로 교차하지 않는지 테스트가 그대로 재야 하기 때문이다.
 */
export interface StrokePoint { x: number; y: number }

/** 리본을 몇 마디로 끊어 그릴지. 늘리면 곡선이 매끄러워지고 그만큼 점이 많아진다. */
const SEGMENTS = 10;

/** 이차 베지에 한 점. 가운데 점이 휘는 정도를 정한다. */
function bezier(from: StrokePoint, control: StrokePoint, to: StrokePoint, t: number): StrokePoint {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
    y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
  };
}

/**
 * 뿌리(`from`)에서 끝(`to`)까지 휘어 가는 리본의 외곽선.
 *
 * 한쪽 변을 앞에서 뒤로, 반대쪽 변을 뒤에서 앞으로 이어 닫힌 폴리곤 하나를 만든다.
 */
export function lashPoints(
  from: StrokePoint,
  control: StrokePoint,
  to: StrokePoint,
  rootWidth: number,
  tipWidth: number,
): StrokePoint[] {
  const spine: StrokePoint[] = [];
  for (let step = 0; step <= SEGMENTS; step += 1) spine.push(bezier(from, control, to, step / SEGMENTS));
  const left: StrokePoint[] = [];
  const right: StrokePoint[] = [];
  for (let index = 0; index < spine.length; index += 1) {
    const point = spine[index];
    // 마디의 방향은 앞뒤 이웃으로 잡는다. 끝점에서는 한쪽만 있으므로 그 이웃을 그대로 쓴다.
    const before = spine[Math.max(0, index - 1)];
    const after = spine[Math.min(spine.length - 1, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = (rootWidth + (tipWidth - rootWidth) * (index / SEGMENTS)) / 2;
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push({ x: point.x + nx, y: point.y + ny });
    right.push({ x: point.x - nx, y: point.y - ny });
  }
  return [...left, ...right.reverse()];
}
