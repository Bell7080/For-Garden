import Phaser from "phaser";

/**
 * 국소 좌표로 그린 실루엣(평평한 x·y 배열)을 씬 좌표 점 목록으로 옮긴다. 부모 컨테이너의 이동·배율·회전을 모두
 * 지나므로, 기울인 판·눌린 버튼도 화면에 선 그대로의 모양이 나온다. 튜토리얼 강조가 버튼의 깎임·원근을 따르는 데 쓴다.
 */
export function outlineInScene(object: Phaser.GameObjects.Components.Transform, flat: readonly number[]): { x: number; y: number }[] {
  const matrix = object.getWorldTransformMatrix();
  const points: { x: number; y: number }[] = [];
  const out = new Phaser.Math.Vector2();
  for (let index = 0; index + 1 < flat.length; index += 2) {
    matrix.transformPoint(flat[index], flat[index + 1], out);
    points.push({ x: out.x, y: out.y });
  }
  return points;
}

/** 실루엣을 감싸는 상자(씬 좌표) — 구멍의 입력 막은 이 상자 둘레에 선다. */
export function outlineBounds(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number; width: number; height: number } {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
