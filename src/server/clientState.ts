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

/**
 * 클라이언트용 투영. 화면이 읽지 않는 서버 장부와 아직 알면 안 되는 값을 뺀다(보안 점검 H1, 2026-11-23).
 *
 * - `serverJournal`은 통째로 비운다 — 처리 영수증뿐 아니라 전투 임대의 **시드**, 결투 상대의 가림 칸이 든 입장권,
 *   레이드·수호전·길드전 입장 영수증이 모두 여기 있다. 화면은 이 장부를 한 번도 읽지 않고 필요한 값은 API 결과로 받는다.
 * - 고고학 판의 **아직 안 판 칸**은 내용을 지운다. 화면은 `archaeologyState`가 주는 `StrataBoardView`만 그린다.
 *
 * 새로 「서버만 아는 값」을 저장에 두면 여기서 함께 가린다.
 */
export function withoutReceipts(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const source = state as { serverJournal?: unknown; archaeology?: unknown };
  let next: Record<string, unknown> = source as Record<string, unknown>;
  if (source.serverJournal && typeof source.serverJournal === "object") next = { ...next, serverJournal: { receipts: {}, raidAdmissions: {} } };
  const archaeology = source.archaeology as { board?: { tiles?: unknown } | null } | undefined;
  const tiles = archaeology?.board?.tiles;
  if (archaeology && archaeology.board && Array.isArray(tiles)) {
    const hidden = tiles.map((tile) => {
      if (!tile || typeof tile !== "object" || (tile as { revealed?: unknown }).revealed === true) return tile;
      const { index, zone } = tile as { index?: unknown; zone?: unknown };
      return { index, zone, kind: "empty", amount: 0, revealed: false };
    });
    next = { ...next, archaeology: { ...archaeology, board: { ...archaeology.board, tiles: hidden } } };
  }
  return next;
}
