import type { RelicDef } from "./types";

/**
 * 듀오가 서는 자리. 3인 편성이면 가운데(1번)다.
 *
 * "전투력이 가장 높은 아군"으로 두면 룬과 레벨에 따라 조용히 바뀌어, 화면에서 왜 저 아이에게
 * 붙었는지가 읽히지 않는다. 자리는 플레이어가 직접 정하는 값이라 규칙이 그대로 보인다.
 */
export function duoSlotIndex(size: number): number {
  return Math.floor((size - 1) / 2);
}

/**
 * 그 자리에 그 개체를 세울 수 있는가.
 *
 * 듀오를 짝짓는 개체(`duoLink`)만 **가운데에 설 수 없다** — 짝이 자기 자신이 되면 붙을 상대가
 * 없어 패시브가 통째로 비고, 화면에는 왜 아무 일도 일어나지 않는지가 남지 않는다.
 */
export function canStandInSlot(relic: Pick<RelicDef, "passive"> | undefined, index: number, size: number): boolean {
  if (relic === undefined) return true;
  return relic.passive.kind !== "duoLink" || index !== duoSlotIndex(size);
}

/**
 * 편성의 두 자리를 교환한다.
 *
 * 빈 값도 일반 값처럼 교환하므로 채워진 칸을 빈 칸으로 옮기면 출발 칸은 자연스럽게 빈다.
 * 실패와 동일 칸 드롭도 호출자가 입력 배열과 결과 배열을 구분할 수 있도록 얕은 사본을 반환한다.
 *
 * `allow`를 주면 **바뀐 두 자리만** 다시 검사해, 설 수 없는 자리로 옮기는 교환을 통째로
 * 되돌린다. 미리보기와 확정이 같은 함수를 지나므로 보여 준 것과 놓은 결과가 갈리지 않는다.
 */
export function moveFormationSlot<T>(formation: readonly T[], from: number, to: number, allow?: (value: T, index: number) => boolean): T[] {
  const next = [...formation];
  // 소수 인덱스까지 배열 프로퍼티로 새는 일을 막고, 범위 밖 입력은 명시적인 no-op으로 둔다.
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  [next[from], next[to]] = [next[to], next[from]];
  if (allow !== undefined && (!allow(next[from], from) || !allow(next[to], to))) return [...formation];
  return next;
}

/**
 * 설 수 없는 자리에 놓인 개체를 **가장 가까운 설 수 있는 자리로 밀어 낸다.**
 *
 * 자리 제약을 확정 경계에서만 막으면, 카드를 고르는 순서에 따라 편성이 조용히 거절되고
 * 화면에는 왜 시작할 수 없는지가 남지 않는다. 고르는 순간 자리를 정리해 두면 플레이어가
 * 제약을 몰라도 늘 세울 수 있는 편성이 나온다. 옮길 자리가 없으면 그대로 둔다.
 */
export function settleFormationSlots<T>(formation: readonly T[], allow: (value: T, index: number) => boolean): T[] {
  const next = [...formation];
  for (let index = 0; index < next.length; index += 1) {
    if (allow(next[index], index)) continue;
    const swap = next.findIndex((value, other) => other !== index && allow(value, index) && allow(next[index], other));
    if (swap < 0) continue;
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
