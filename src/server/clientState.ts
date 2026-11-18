/**
 * 클라이언트로 내려보내는 응답의 상태를 다듬는다.
 *
 * - 처리 영수증(`serverJournal.receipts`)은 서버만 읽는다(재전송 복구·결제 기록). 화면은 한 번도 읽지 않는데
 *   저장의 대부분을 차지해, 그대로 보내면 호출마다 수백 KB를 받고 메인 스레드에서 통째로 검증했다.
 * - 조회가 이미 가진 revision을 말하면(`knownRevision`) 상태가 같으므로 아예 싣지 않는다 — 전투 중 알림 조회가
 *   매번 전체 저장을 다시 받아 검증하던 것이 렉의 한 원인이었다.
 */
export function clientResponseState<T extends { state?: unknown; revision?: unknown }>(response: T, knownRevision?: unknown): T {
  if (typeof knownRevision === "string" && knownRevision.length > 0 && String(response.revision) === knownRevision) {
    const { state: _state, ...rest } = response;
    return rest as T;
  }
  return { ...response, state: withoutReceipts(response.state) };
}

export function withoutReceipts(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const journal = (state as { serverJournal?: unknown }).serverJournal;
  if (!journal || typeof journal !== "object") return state;
  return { ...(state as object), serverJournal: { ...(journal as object), receipts: {} } };
}
