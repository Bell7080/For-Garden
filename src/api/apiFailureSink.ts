/**
 * API 계층이 서버 오류를 알리는 출구. `api`는 `managers`를 import하지 않으므로(의존 방향) 보고기가 부트에서
 * 이 자리에 자신을 꽂는다. 꽂히기 전·꽂지 않은 빌드에서는 아무 일도 하지 않는다.
 */
export const apiFailureSink: { report?: (code: string, error: unknown, context: Record<string, unknown>) => void } = {};
