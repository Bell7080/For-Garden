/**
 * 가방에서 연 룬 쪽지·세공 판을 **좌우로 넘기는 순서**의 순수 규칙.
 *
 * 순서는 판을 여는 순간 가방이 그려 둔 줄(정렬·필터·검색을 지난 그대로)을 **사진으로 찍어** 쓴다.
 * 세공하는 동안 가방의 정렬(세공 횟수순 등)이나 필터(「세공 안 한 룬」 등)가 그 룬을 다른 자리로
 * 옮기거나 목록에서 뺄 수 있는데, 그 줄을 매번 다시 읽으면 방금 본 룬의 다음 칸이 손 밑에서 바뀐다.
 * 그 사이에 사라진 룬(판매·합성)만 빼고 센다 — 위치 표기와 넘김이 같은 셈을 읽는다.
 * 끝에서는 돌지 않고 멈춘다.
 */

/** 지금 가방에 남아 있는 룬만 남긴 순서. */
export function runeBrowseLive(order: readonly string[], exists: (instanceId: string) => boolean): string[] {
  return order.filter(exists);
}

/** 지금 룬의 자리(1부터)와 전체 수. 순서에 없는 룬이면 `undefined`다. */
export function runeBrowsePosition(
  order: readonly string[],
  currentId: string,
  exists: (instanceId: string) => boolean,
): { index: number; total: number } | undefined {
  const live = runeBrowseLive(order, exists);
  const at = live.indexOf(currentId);
  return at < 0 ? undefined : { index: at + 1, total: live.length };
}

/** 옆 룬의 ID. 끝이면 `undefined`다 — 돌아서 반대쪽 끝으로 가지 않는다. */
export function runeBrowseNeighbor(
  order: readonly string[],
  currentId: string,
  step: -1 | 1,
  exists: (instanceId: string) => boolean,
): string | undefined {
  const live = runeBrowseLive(order, exists);
  const at = live.indexOf(currentId);
  if (at < 0) return undefined;
  return live[at + step];
}

/** 쓸어 넘기기로 읽는 최소 가로 거리와, 세로 움직임이 가로의 몇 배를 넘으면 넘기지 않는지. */
export const RUNE_BROWSE_SWIPE = { distance: 110, slope: 0.8 } as const;

/** 손을 뗀 순간의 가로·세로 이동에서 넘길 방향을 읽는다. 왼쪽으로 쓸면 다음(+1)이다. */
export function runeBrowseSwipe(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < RUNE_BROWSE_SWIPE.distance) return 0;
  if (Math.abs(dy) > Math.abs(dx) * RUNE_BROWSE_SWIPE.slope) return 0;
  return dx < 0 ? 1 : -1;
}
