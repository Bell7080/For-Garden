import type { ObservationRecord } from "../state/session";

/**
 * 관찰 기록을 별도 팝업 레이어로 다루기 위한 순수 규칙.
 *
 * 관찰 일지 본문에는 최신 한 건만 두고, 쌓인 전체 이력은 이 규칙이 정하는 순서와 범위로
 * 딴 팝업(`openObservationHistory`)이 한 건씩 넘겨 보여 준다 — 매일 쌓이는 기록을 전부
 * 본문에 밀어 넣으면 캐릭터 소개보다 인터뷰 로그가 더 길어진다.
 */

/** 최신 순으로 다시 정렬한다. 저장은 완료한 순서(오래된 것부터)로 쌓이므로 뒤집기만 한다. */
export function sortedObservationHistory(records: readonly ObservationRecord[]): readonly ObservationRecord[] {
  return [...records].reverse();
}

/** 페이지 인덱스를 실제 있는 기록 범위 안으로 붙잡아 둔다. 기록이 없으면 0에 고정한다. */
export function clampObservationPage(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}
