/** 원격 결과의 전체 Session은 RemoteGameApi가 revision 순서로 이미 반영했다.
 * 표시용 지급 영수증을 Manager가 다시 현재 상태로 복사하면 오래된 결과가 새 상태를 되돌린다.
 * 이 표식은 메모리 전용이며 DTO·저장·네트워크에는 추가하지 않는다.
 */
const remoteResults = new WeakSet<object>();
export function markRemoteStateResult(result: unknown): void {
  if (result && typeof result === "object") remoteResults.add(result);
}
export function hasRemoteState(result: unknown): boolean {
  return !!result && typeof result === "object" && remoteResults.has(result);
}
