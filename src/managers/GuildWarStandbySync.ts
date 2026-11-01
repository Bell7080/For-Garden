import { gameApi } from "../api/FakeServer";

/**
 * 길드전 대기 방어덱을 하루(UTC) 한 번 서버에 넣어 둔다 — 길드전 화면을 열지 않는 길드원도 준비일에 자동으로 배치되도록.
 * 덱을 고르는 일(결투 방어덱 · 없으면 가장 센 셋)은 서버가 하고, 여기서는 부를 때만 정한다.
 *
 * **그날 넣는 데 성공했을 때만** 했다고 적는다. 예전에는 부르기 전에 적어 두어, 로비에 들어온 순간 아직 길드가 없었거나
 * (`NOT_IN_GUILD` → `synced: false`) 요청이 실패하면 그날은 다시 넣지 않았다 — 오늘 가입한 길드원은 대기 덱이 비어
 * 다음 날까지 자동 배치에서 빠졌다(일반 길드원만 자동 배치가 안 되는 것처럼 보이던 원인).
 */
let syncedDay: number | undefined;
let inFlight: Promise<boolean> | undefined;
/** 마지막으로 넣어 본 시각 — 넣지 못하는 계정(렐릭이 셋 안 됨)이 화면을 다시 그릴 때마다 요청을 보내지 않게 한다. */
let lastAttemptAt = Number.NEGATIVE_INFINITY;
const RETRY_GAP_MS = 60_000;

const dayOf = (now: number): number => Math.floor(now / 86_400_000);

/** 지금 넣는다. 이미 오늘 넣었으면 건너뛴다(`force`면 다시 넣는다). 넣었으면 true. */
export function syncGuildWarStandby(now = Date.now(), force = false): Promise<boolean> {
  const day = dayOf(now);
  if (!force && syncedDay === day) return Promise.resolve(true);
  if (inFlight) return inFlight;
  if (!force && now - lastAttemptAt < RETRY_GAP_MS) return Promise.resolve(false);
  lastAttemptAt = now;
  inFlight = gameApi.syncGuildWarStandby()
    .then(({ synced }) => { if (synced) syncedDay = day; return synced; })
    .catch(() => false)
    .finally(() => { inFlight = undefined; });
  return inFlight;
}

export function syncGuildWarStandbyDaily(now = Date.now()): void {
  void syncGuildWarStandby(now);
}

/** 테스트 전용 — 모듈 상태를 비운다. */
export function resetGuildWarStandbySyncForTest(): void {
  syncedDay = undefined;
  inFlight = undefined;
  lastAttemptAt = Number.NEGATIVE_INFINITY;
}
