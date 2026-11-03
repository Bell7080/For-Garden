/**
 * 정규 이벤트 교대 — 주마다 한 이벤트만 서고, 다음 UTC 월요일 00:00에 다음 이벤트로 넘어간다(응태 결정, 2026-11-03).
 * 코인이 이번 주에 쓴 스테미나라 두 이벤트가 같은 주에 서면 숙제가 겹치므로 한 주에 하나만 연다.
 * 순서는 이 배열 하나가 갖는다 — 새 정규 이벤트는 여기 한 줄을 더하면 차례에 끼어든다.
 */
export const REGULAR_EVENT_CYCLE: readonly string[] = ["chest-forge", "delophy-hunt", "shute-fishing"];

/** 첫 칸(티아의 보물상자)이 처음 선 주의 월요일 00:00(UTC). */
const ROTATION_ANCHOR = Date.UTC(2026, 10, 2);
const WEEK_MS = 7 * 86_400_000;

/** `now`가 속한 UTC 주가 앵커 주에서 몇 번째인지(앵커 이전도 순환에 맞춰 0 이상으로 접는다). */
export function regularEventWeekIndex(now: number | Date): number {
  const time = typeof now === "number" ? now : now.getTime();
  const weeks = Math.floor((time - ROTATION_ANCHOR) / WEEK_MS);
  const size = REGULAR_EVENT_CYCLE.length;
  return ((weeks % size) + size) % size;
}

export function activeRegularEventId(now: number | Date): string {
  return REGULAR_EVENT_CYCLE[regularEventWeekIndex(now)];
}

/** 순환에 들지 않는 이벤트(돌림판 등 고정 이벤트)는 늘 열려 있다. */
export function isRegularEventActive(id: string, now: number | Date): boolean {
  return !REGULAR_EVENT_CYCLE.includes(id) || activeRegularEventId(now) === id;
}
