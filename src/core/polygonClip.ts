/**
 * 볼록·오목 다각형을 가로 띠(top ≤ y ≤ bottom) 안으로 자른다(서덜랜드–호지먼, 가로 두 평면).
 *
 * 기하 마스크 두 장은 겹쳐 물릴 수 없으므로, 굴러가는 판 안의 장식(출격판 SD)은 제 마스크 도형을 판의 보이는 구간으로
 * 먼저 잘라 한 장에 담는다. 점은 `[x0, y0, x1, y1, …]`로 받고 같은 꼴로 돌려준다. 띠 밖이면 빈 배열이다.
 */
export function clipPolygonToBand(flat: readonly number[], top: number, bottom: number): number[] {
  let points: number[] = [...flat];
  const cut = (inside: (y: number) => boolean, edge: number): void => {
    const next: number[] = [];
    const count = points.length / 2;
    for (let index = 0; index < count; index += 1) {
      const ax = points[index * 2];
      const ay = points[index * 2 + 1];
      const bx = points[((index + 1) % count) * 2];
      const by = points[((index + 1) % count) * 2 + 1];
      const aIn = inside(ay);
      const bIn = inside(by);
      if (aIn) next.push(ax, ay);
      if (aIn !== bIn) {
        const ratio = (edge - ay) / (by - ay);
        next.push(ax + (bx - ax) * ratio, edge);
      }
    }
    points = next;
  };
  if (points.length < 6) return [];
  cut((y) => y >= top, top);
  if (points.length < 6) return [];
  cut((y) => y <= bottom, bottom);
  return points.length < 6 ? [] : points;
}
