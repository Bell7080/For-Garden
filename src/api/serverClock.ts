/**
 * 서버 시계. 기기 시계로 재던 만료·주기·쿨다운을 서버 `now()` 기준으로 옮기는 바닥이다.
 * 서버 응답 시각과 요청 왕복의 가운데 기기 시각의 차이(오프셋)만 기억하고, 서버를 부를 수 없는
 * 빌드·네트워크에서는 오프셋 0으로 기기 시계를 그대로 쓴다(성공을 흉내 내지 않고 지금과 같게 둔다).
 * 오프셋은 메모리에만 두며 저장하지 않는다.
 */
let offsetMs = 0;

/** 왕복이 길수록 오차가 크므로, 요청 전후 기기 시각의 가운데를 서버 시각과 맞춘다. */
export function syncServerClock(serverNowIso: string, localBeforeMs: number, localAfterMs: number): boolean {
  const server = Date.parse(serverNowIso);
  if (!Number.isFinite(server) || localAfterMs < localBeforeMs) return false;
  offsetMs = server - (localBeforeMs + localAfterMs) / 2;
  return true;
}

export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}

export function serverClockOffsetMs(): number {
  return offsetMs;
}

export function resetServerClock(): void {
  offsetMs = 0;
}
