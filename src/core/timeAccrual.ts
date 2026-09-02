/** 서버 시각 기반 정산에서 도메인 공식이 공통으로 소비하는 순수 시간 구간이다. */
export interface TimeAccrualWindow {
  /** 파싱을 마친 마지막 정상 정산 시각이다. */
  startMs: number;
  /** clamp가 적용된 계산 구간의 끝이며, 응답 시각과 다를 수 있다. */
  effectiveEndMs: number;
  /** 도메인 상한을 적용한 실제 계산 시간이다. */
  elapsedMs: number;
  /** 서버가 확정한 현재 시각으로, 정상 정산 뒤 저장할 기준점이다. */
  serverNowMs: number;
}

/** 유효하지 않은 서버 시각이나 역행을 생산 0인 거절 결과로 명시한다. */
export type TimeAccrualResult =
  | { accepted: true; initialized: boolean; window: TimeAccrualWindow }
  | { accepted: false; reason: "invalid-server-time" | "clock-regression" };

/**
 * 서버 시각 검증, 마지막 시각 역행 방어, 장기 경과 clamp만 수행한다.
 *
 * 생산량·틱 개수·보관 한도는 의도적으로 받지 않는다. 각 도메인이 계산 가능한 최대 시간만
 * 넘겨 발굴의 복수 재화 공식과 스테미나의 정수 틱 공식이 이 모듈에 섞이지 않게 한다.
 */
export function timeAccrualWindow(lastSettledAt: string | null, serverNow: Date, maxElapsedMs = Number.POSITIVE_INFINITY): TimeAccrualResult {
  const serverNowMs = serverNow.getTime();
  // 신뢰 기준인 서버 시각 자체가 잘못되면 ISO 변환이나 보상 계산을 시도하지 않는다.
  if (!Number.isFinite(serverNowMs)) return { accepted: false, reason: "invalid-server-time" };

  const parsedStartMs = lastSettledAt === null ? Number.NaN : Date.parse(lastSettledAt);
  // 빈 값과 손상된 구버전 값은 과거를 추측하지 않고 현재를 최초 기준점으로 삼는다.
  if (!Number.isFinite(parsedStartMs)) {
    return { accepted: true, initialized: true, window: { startMs: serverNowMs, effectiveEndMs: serverNowMs, elapsedMs: 0, serverNowMs } };
  }
  // 같은 시각은 정상적인 무경과 정산이지만, 역행은 마지막 정상 기준점을 보존해야 한다.
  if (serverNowMs < parsedStartMs) return { accepted: false, reason: "clock-regression" };

  const safeMaximum = Number.isFinite(maxElapsedMs) ? Math.max(0, maxElapsedMs) : Number.POSITIVE_INFINITY;
  const elapsedMs = Math.min(serverNowMs - parsedStartMs, safeMaximum);
  return { accepted: true, initialized: false, window: { startMs: parsedStartMs, effectiveEndMs: parsedStartMs + elapsedMs, elapsedMs, serverNowMs } };
}

/** 계산 구간 중 만료 경계 이전과 이후 시간을 나눠 배율 도메인이 경계를 중복 구현하지 않게 한다. */
export function splitAccrualAt(window: TimeAccrualWindow, boundaryAt: string | null | undefined): { beforeMs: number; afterMs: number } {
  const boundaryMs = boundaryAt ? Date.parse(boundaryAt) : window.startMs;
  // 손상되거나 이미 지난 경계는 전체를 기본 구간으로 안전하게 돌린다.
  const beforeMs = Number.isFinite(boundaryMs) ? Math.max(0, Math.min(window.effectiveEndMs, boundaryMs) - window.startMs) : 0;
  return { beforeMs, afterMs: window.elapsedMs - beforeMs };
}
