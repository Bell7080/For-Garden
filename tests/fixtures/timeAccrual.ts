/** 발굴과 스테미나가 함께 소비하는 시계 회귀 fixture이며 도메인 생산량은 넣지 않는다. */
export const TIME_ACCRUAL_FIXTURES = {
  /** 서로 다른 ISO 시간대 표기가 같은 절대 시각 구간으로 계산되는 경우다. */
  timezoneChange: { lastSettledAt: "2026-09-01T09:00:00.000+09:00", serverNow: "2026-09-01T01:00:00.000Z" },
  /** 클라이언트 저장 기준보다 서버 시각이 과거인 공격/오류 경우다. */
  clockRegression: { lastSettledAt: "2026-09-01T01:00:00.000Z", serverNow: "2026-09-01T00:00:00.000Z" },
  /** 각 도메인의 보관량/완충량 상한보다 훨씬 긴 오프라인 경우다. */
  longOffline: { lastSettledAt: "2025-09-01T00:00:00.000Z", serverNow: "2026-09-01T00:00:00.000Z" },
  /** 강화 종료와 정산 끝이 정확히 일치해 경계 1ms를 중복하지 않는 경우다. */
  expiryBoundary: { lastSettledAt: "2026-09-01T00:00:00.000Z", serverNow: "2026-09-01T01:00:00.000Z", expiresAt: "2026-09-01T01:00:00.000Z" },
} as const;
