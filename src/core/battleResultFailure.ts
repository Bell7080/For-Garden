/** 서버 원문/저장/토큰을 노출하지 않는 전투 종료 진단이다. */
const REPLAY_REASONS = new Set(["COMBAT_REJECTED", "COMBAT_NOT_VERIFIED", "COMBAT_TOO_FAST", "REPLAY_VERSION_REQUIRED", "INVALID_ACTIONS", "RAID_SCORE_REJECTED", "EXPEDITION_SCORE_REJECTED"]);
export type BattleResultPhase = "prepare" | "verify" | "stage" | "cake" | "bounty" | "duel" | "expedition" | "raid" | "display";
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
