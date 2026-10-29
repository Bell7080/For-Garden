import { gameApi } from "../api/FakeServer";

/**
 * 길드전 대기 방어덱을 하루(UTC) 한 번 서버에 넣어 둔다 — 길드전 화면을 열지 않는 길드원도 준비일에 자동으로 배치되도록.
 * 덱을 고르는 일(결투 방어덱 · 없으면 가장 센 셋)은 서버가 하고, 여기서는 부를 때만 정한다. 실패는 다음 날 다시 시도한다.
 */
let syncedDay: number | undefined;

export function syncGuildWarStandbyDaily(now = Date.now()): void {
  const day = Math.floor(now / 86_400_000);
  if (syncedDay === day) return;
  syncedDay = day;
  void gameApi.syncGuildWarStandby().catch(() => undefined);
}
