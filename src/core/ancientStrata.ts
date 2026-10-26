/**
 * 고대 지층 — 끝없이 내려가는 지층 탐사(무한 모드)의 층 규칙.
 *
 * 지도 구간과 배경 규칙. 전투 정의는 ancientStrataBattle.ts, 전용 난이도 표는
 * data/ancientStrataDifficulty.ts가 소유한다. 진행·보상 지급은 아직 연결하지 않았다.
 */

/** 한 구간(한 장의 지도)에 담기는 층 수. */
export const ANCIENT_FLOORS_PER_BLOCK = 10;

export type AncientBackdrop = "entry" | "loopA" | "loopB" | "loopC";

/**
 * 첫 구간은 입구 원화, 그 뒤로는 반복 세 장이 1 → 3 → 2 순으로 돈다.
 * 원화가 장별로 끊겨 있어 이어 붙지 않으므로 같은 그림이 연달아 나오지 않게만 돌린다.
 */
const LOOP_ORDER: readonly AncientBackdrop[] = ["loopA", "loopB", "loopC"];

/** 층(1부터)이 속한 구간 번호(0부터). */
export function ancientBlockOf(floor: number): number {
  return Math.floor((Math.max(1, Math.floor(floor)) - 1) / ANCIENT_FLOORS_PER_BLOCK);
}

/** 구간의 첫 층과 마지막 층. */
export function ancientBlockFloors(block: number): { first: number; last: number } {
  const first = Math.max(0, Math.floor(block)) * ANCIENT_FLOORS_PER_BLOCK + 1;
  return { first, last: first + ANCIENT_FLOORS_PER_BLOCK - 1 };
}

/** 구간이 쓰는 배경. */
export function ancientBlockBackdrop(block: number): AncientBackdrop {
  const index = Math.max(0, Math.floor(block));
  return index === 0 ? "entry" : LOOP_ORDER[(index - 1) % LOOP_ORDER.length];
}

/** 구간의 마지막 층은 관문이다 — 노드가 한 단계 크게 선다. */
export function isAncientGate(floor: number): boolean {
  return floor > 0 && floor % ANCIENT_FLOORS_PER_BLOCK === 0;
}
