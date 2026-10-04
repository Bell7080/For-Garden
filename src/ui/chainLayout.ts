/** 사슬 고리 사이 간격(px). */
export const CHAIN_STEP = 24;

export interface ChainLink { x: number; y: number; angle: number; long: boolean }

/** 두 점 사이에 고리를 같은 간격으로 늘어놓는다. 고리는 길게 선 것과 모로 선 것이 번갈아 이어진다. */
export function chainLinks(x1: number, y1: number, x2: number, y2: number): ChainLink[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const count = Math.max(1, Math.floor(length / CHAIN_STEP));
  const angle = Math.atan2(dy, dx);
  return Array.from({ length: count + 1 }, (_, i) => ({
    x: x1 + (dx * i) / count,
    y: y1 + (dy * i) / count,
    angle,
    long: i % 2 === 0,
  }));
}

