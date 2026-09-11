/**
 * 편성의 두 자리를 교환한다.
 *
 * 빈 값도 일반 값처럼 교환하므로 채워진 칸을 빈 칸으로 옮기면 출발 칸은 자연스럽게 빈다.
 * 실패와 동일 칸 드롭도 호출자가 입력 배열과 결과 배열을 구분할 수 있도록 얕은 사본을 반환한다.
 */
export function moveFormationSlot<T>(formation: readonly T[], from: number, to: number): T[] {
  const next = [...formation];
  // 소수 인덱스까지 배열 프로퍼티로 새는 일을 막고, 범위 밖 입력은 명시적인 no-op으로 둔다.
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
