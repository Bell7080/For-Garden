/**
 * 서버가 대신 실행해 주는 GameApi 메서드 목록이다. 이 목록에 없는 이름은 요청이 와도 실행하지 않는다.
 * 구독(`subscribeMissionNotice`)처럼 클라이언트에만 있는 메서드는 넣지 않는다.
 * `tests/unit/gameHandler.test.ts`가 GameApi 인터페이스와 이 목록이 같은지 지킨다.
 */
export const SERVER_GAME_METHODS = [
  "abandonStrataRun", "activatePass", "answerRelicQuestion", "archaeologyState", "breakThroughRelic", "buyDuelAttempt",
  "claimAchievementRewards", "claimAdReward", "claimAttendance", "claimAttendanceAd", "claimDuelSeasonReward", "claimExpeditionReward", "claimInstantAdReward",
  "claimInteractionDispatch", "claimMailRewards", "claimMissionRewards", "claimPassDailyBonus", "claimProgressPass", "claimRelicChapter",
  "claimRelicQuestionReward", "completeBounty", "completeCakeOperation", "completeExpeditionNode", "completeStage", "digStrataTile",
  "engraveRune", "enhanceRune", "enterBounty", "enterCakeOperation", "enterDailyRestoration", "enterDuel", "enterEventStage", "enterRaid",
  "enterStage", "equipRune", "feedRelic", "fulfillPlatformPurchase", "getAchievements", "getAdOperationsConfig", "getAsyncArenaServerState", "getAttendance",
  "getBountyStatus", "getDuelRanking", "getDuelStatus", "getEvents", "getExpeditionLeaderboard", "getExpeditionWeeklyBest",
  "getIdleExcavation", "getInteractionCities", "getInteractionDispatch", "getInventory", "getMails", "getMissions", "getNotificationSignals",
  "getPlayerState", "getProducts", "getProgressPasses", "getRaids", "getStaminaRechargeStatus", "grantRuneTrait", "harvestExcavation",
  "interactInLobby", "markAttendanceAutoShown", "markMailsRead", "markRune", "pullRelics", "purchaseProduct", "purchaseRelicSkin",
  "rechargeStamina", "refreshDuelOpponents", "renameRune", "rerollRuneTrait", "resolveDuel", "resolveRuneTraitReroll", "saveExcavationFormation",
  "sellRunes", "setDuelDefense", "settleExpeditionRun", "settleRaid", "startInteractionDispatch", "startStrataRun", "submitExpeditionBossScore",
  "submitRaidDamage", "summonRaid", "sweepBounty", "sweepCakeOperation", "sweepExpedition", "unequipRune", "upgradeRuneTrait",
  "useConsumable", "verifyPurchaseReceipt",
] as const;

export type ServerGameMethod = (typeof SERVER_GAME_METHODS)[number];

const METHOD_SET: ReadonlySet<string> = new Set(SERVER_GAME_METHODS);
export function isServerGameMethod(name: unknown): name is ServerGameMethod {
  return typeof name === "string" && METHOD_SET.has(name);
}
