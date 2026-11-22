/**
 * 아레나 친선전 요청 띠가 서버에 묻는 주기(2026-11-22 발열·배터리 재진단).
 *
 * 요청은 실시간 신호(`arena_signals`)가 곧바로 깨우므로, 주기 조회는 신호가 끊겼을 때의 되돌이일 뿐이다.
 * 8초마다 묻던 때는 로비에 서 있는 내내 조회가 몇 초 간격으로 이어져 휴대폰의 통신 모뎀이 쉬지 못했다
 * (주기 조회 15초 · 기기 확인 45초와 겹쳐 5초에 한 번꼴). 신호가 살아 있으면 1분에 한 번만, 끊겼으면 예전처럼 8초다.
 */
export const ARENA_NOTICE_TICK_MS = 8_000;
export const ARENA_NOTICE_FALLBACK_MS = 60_000;

/** 이 박자에 서버에 물을 차례인가. */
export function arenaNoticePollDue(now: number, lastPollAt: number, realtimeLive: boolean): boolean {
  return !realtimeLive || now - lastPollAt >= ARENA_NOTICE_FALLBACK_MS;
}
