/** HTTP와 원격 어댑터가 공유하는 요청 경계. 메서드 이름의 접두사로 쓰기를 추측하지 않는다. */
export const READ_METHODS = new Set([
  "arena.get",
  "archaeologyState",
  "getAchievements",
  "getAncientRanking",
  "getAdOperationsConfig",
  "getAsyncArenaServerState",
  "getAttendance",
  "getBountyStatus",
  "getDuelRanking",
  "getDuelStatus",
  "getEvents",
  "getRouletteStatus",
  "getExpeditionLeaderboard",
  "getExpeditionWeeklyBest",
  "getIdleExcavation",
  "getInteractionCities",
  "getInteractionDispatch",
  "getInventory",
  "getMails",
  "getMissions",
  "getNotificationSignals",
  "getPlayerState",
  "getProducts",
  "getProgressPasses",
  "getRaids",
  "getStaminaRechargeStatus",
  "verifyPurchaseReceipt",
  "social.getFriends",
  "social.getRequests",
  "social.searchUsers",
  "social.getRecommendations",
  "guild.getGuild",
  "guild.searchGuilds",
  "guild.getMembers",
  "guild.getAttendance",
  "guild.getShop",
  "guild.getGuard",
  "guild.getRanking",
  "guild.getWarMap",
  "guild.getWarFront",
  "getGuildGuard",
]);
export const isReadMethod = (method: string): boolean =>
  READ_METHODS.has(method);
export const REQUEST_ID = /^[A-Za-z0-9_.:-]{8,64}$/;
export const MAX_BODY_BYTES = 128 * 1024;
export function validCall(
  value: unknown,
): value is { method: string; args?: unknown[]; requestId?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const call = value as Record<string, unknown>;
  return (
    typeof call.method === "string" &&
    call.method.length <= 64 &&
    (call.args === undefined ||
      (Array.isArray(call.args) && call.args.length <= 4)) &&
    (call.requestId === undefined ||
      (typeof call.requestId === "string" && REQUEST_ID.test(call.requestId)))
  );
}
/** 서버리스 인스턴스가 달라도 같은 계정의 DB 호출 예산을 공유한다. */
export function requestBudget(method: string): {
  windowSeconds: number;
  limit: number;
} {
  if (method === "social.searchUsers") return { windowSeconds: 60, limit: 20 };
  return { windowSeconds: 60, limit: isReadMethod(method) ? 180 : 60 };
}
