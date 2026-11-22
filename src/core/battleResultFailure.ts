/** 서버 원문/저장/토큰을 노출하지 않는 전투 종료 진단이다. */
const REPLAY_REASONS = new Set(["COMBAT_REJECTED", "COMBAT_NOT_VERIFIED", "COMBAT_TOO_FAST", "REPLAY_VERSION_REQUIRED", "INVALID_ACTIONS", "RAID_SCORE_REJECTED", "EXPEDITION_SCORE_REJECTED"]);
export type BattleResultPhase = "prepare" | "verify" | "stage" | "cake" | "bounty" | "duel" | "expedition" | "raid" | "guildGuard" | "guildWar" | "display";
export function battleResultFailure(error: unknown, phase: BattleResultPhase) {
  const value = error && typeof error === "object" ? error as { status?: unknown; code?: unknown; message?: unknown } : {};
  const status = typeof value.status === "number" && Number.isInteger(value.status) && value.status >= 400 && value.status <= 599 ? value.status : undefined;
  // DB나 HTTP의 임의 message는 계정 내용이 섞일 수 있어 알려진 규칙 코드만 읽는다.
  const reason = [value.message, value.code].find(code => typeof code === "string" && REPLAY_REASONS.has(code)) as string | undefined;
  const persistence = value.code === "PERSISTENCE_FAILED" || value.message === "PERSISTENCE_FAILED";
  const key: "battle.settle.scoreRejected" | "battle.settle.persistenceFailed" | "battle.result.saveFailed" | "battle.settle.failed" = phase === "display" ? "battle.settle.failed" : reason ? "battle.settle.scoreRejected" : persistence ? "battle.settle.persistenceFailed" : "battle.result.saveFailed";
  const code = reason ?? (persistence ? "PERSISTENCE_FAILED" : status ? `HTTP_${status}` : error instanceof Error ? "CLIENT_OR_NETWORK" : "UNKNOWN");
  return { key, reference: `${phase}:${code}`, status };
}

/**
 * 결과 확정이 **서버 사정**으로 끊겼는가 — 규칙이 거절한 판(4xx·재현 거절)이 아니라 잠깐의 망 단절·
 * 서버 과부하·시간 초과라 같은 요청을 다시 보내면 되는 경우다. 결과판은 이때 사람에게 묻기 전에
 * 조용히 몇 번 다시 보낸다(`RESULT_AUTO_RETRY_DELAYS_MS`). 2026-11-22 서버→DB 연결이 40초쯤 멎어
 * `verify:HTTP_503`이 그대로 떴던 일이 그 예다 — 전투 영수증(lease)은 한 시간 살아 있어 다시 보내면 확정된다.
 */
export function isTransientResultFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; code?: unknown; message?: unknown; name?: unknown };
  if ([value.message, value.code].some(code => typeof code === "string" && (REPLAY_REASONS.has(code) || code === "PERSISTENCE_FAILED"))) return false;
  const status = typeof value.status === "number" ? value.status : undefined;
  if (status !== undefined && status > 0) return status === 408 || status >= 500 || (status === 409 && value.code === "save_conflict");
  // 상태가 없거나 0이면 응답 자체를 받지 못한 것이다(망 단절·시간 초과).
  return error instanceof Error && (status === 0 || value.name === "TypeError" || value.name === "TimeoutError" || value.name === "AbortError" || value.code === "network");
}

/** 결과 확정이 서버 사정으로 끊겼을 때 사람에게 묻기 전 조용히 다시 보내는 간격 — 실제 시간이다. */
export const RESULT_AUTO_RETRY_DELAYS_MS = [1500, 4000, 8000] as const;
