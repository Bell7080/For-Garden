/**
 * 화면에 보이는 자리 번호로 편성원을 제거한다.
 *
 * 호출자의 배열을 그대로 줄여 뒤 슬롯이 빈자리를 메우게 하며, 잘못된 인덱스는 아무것도
 * 바꾸지 않는다. 캐릭터 ID를 다시 찾지 않으므로 중복이나 비동기 표시 상태와 무관하다.
 */
export function removeFormationSlot<T>(formation: T[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= formation.length) return false;
  formation.splice(index, 1);
  return true;
}
