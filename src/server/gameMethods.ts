/**
 * 서버가 대신 실행해 주는 GameApi 메서드 목록이다. 이 목록에 없는 이름은 요청이 와도 실행하지 않는다.
 * 구독(`subscribeMissionNotice`)처럼 클라이언트에만 있는 메서드는 넣지 않는다.
 * `tests/unit/gameHandler.test.ts`가 GameApi 인터페이스와 이 목록이 같은지 지킨다.
 */
export const SERVER_GAME_METHODS = [
  "getRouletteStatus", "spinRoulette", "unlockRouletteSpins",
  "prepareCombat", "finishCombat",
  "abandonStrataRun", "activatePass", "answerRelicQuestion", "applyDebugCommand", "applyStoryEffect", "archaeologyState", "beginExpeditionAugment", "breakThroughRelic", "buyDuelAttempt", "buyGuildProduct", "changeGuildBadge", "createGuild", "stampGuildAttendance", "getGuildGuard", "enterGuildGuard", "submitGuildGuard", "placeGuildWarDefense", "enterGuildWarAttack", "submitGuildWarAttack",
  "claimAchievementRewards", "claimAdReward", "claimAttendance", "claimAttendanceAd", "claimDuelSeasonReward", "claimExpeditionReward", "claimInstantAdReward",
  "claimInteractionDispatch", "claimMailRewards", "claimMissionRewards", "claimPassDailyBonus", "claimProgressPass", "claimRelicChapter",
  "claimRelicQuestionReward", "chooseExpeditionAugment", "completeBounty", "completeCakeOperation", "completeExpeditionNode", "completeExpeditionRest", "completeObservation", "completeStage", "completeStory", "completeTutorialStep", "digStrataTile",
  "engraveRune", "enhanceRune", "enhanceRuneAll", "enterBounty", "enterCakeOperation", "enterDailyRestoration", "enterDuel", "enterEventStage", "enterRaid",
  "enterStage", "equipProfileModifiers", "equipRelicSkin", "equipRune", "feedRelic", "fulfillPlatformPurchase", "getAchievements", "getAdOperationsConfig", "getAsyncArenaServerState", "getAttendance",
  "getAncientRanking", "getBountyStatus", "getDuelRanking", "getDuelStatus", "getEvents", "getExpeditionLeaderboard", "getExpeditionWeeklyBest",
  "getIdleExcavation", "getInteractionCities", "getInteractionDispatch", "getInventory", "getMails", "getMissions", "getNotificationSignals",
  "getPlayerState", "getProducts", "getProgressPasses", "getRaids", "getStaminaRechargeStatus", "grantRuneTrait", "harvestExcavation",
  "deleteMails", "interactInLobby", "markAttendanceAutoShown", "markContentIntroSeen", "markInteractionJournalRead", "markMailsRead", "markRune", "prepareExpeditionBoss", "pullRelics", "purchaseProduct", "purchaseRelicSkin",
  "rechargeStamina", "refreshDuelOpponents", "renameRune", "rerollRuneTrait", "resolveDuel", "resolveRuneTraitReroll", "saveExcavationFormation",
  "selectArchaeologySite", "sellRunes", "setDuelDefense", "setFavorite", "setParty", "setRelicBookmark", "settleExpeditionRun", "settleRaid", "startExpeditionRun", "startInteractionDispatch", "startStrataRun", "submitExpeditionBossScore",
  "submitRaidDamage", "summonRaid", "sweepBounty", "synthesizeRunes", "sweepCakeOperation", "sweepExpedition", "unequipRune", "updateAccountSettings", "updatePlayerCard", "upgradeRuneTrait",
  "useConsumable", "verifyPurchaseReceipt",
] as const;

export type ServerGameMethod = (typeof SERVER_GAME_METHODS)[number];

const METHOD_SET: ReadonlySet<string> = new Set(SERVER_GAME_METHODS);
export function isServerGameMethod(name: unknown): name is ServerGameMethod {
  return typeof name === "string" && METHOD_SET.has(name);
}
