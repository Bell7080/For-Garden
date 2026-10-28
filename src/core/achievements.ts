import { ACHIEVEMENT_SERIES, type AchievementMetric, type AchievementSeries } from "../data/achievements";
import { BOND_LEVEL_CAP } from "./bond";
import { BREAKTHROUGH_STEPS, relicLevelCap } from "./relicProgression";
import { DUEL_TIERS } from "./duelArena";
import { BOUNTY_TIERS } from "../data/bounty";
import { mergeMissionRewards, type MissionReward } from "./missions";
import { CHAPTERS } from "../data/stages";
import { PLAYABLE_RELICS } from "../data/relics";
import { RECOLLECTION_ENTRIES } from "../data/recollectionCatalog";
import type { Session } from "../state/session";
import type { AchievementState } from "./achievementState";
import { ancientHighestCleared } from "./ancientStrata";
import { ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";

export { createEmptyAchievementState, isValidAchievementState, normalizeAchievementState, type AchievementState } from "./achievementState";

/**
 * 업적의 순수 규칙 — 무엇을 얼마나 해 왔나(`AchievementFacts`)를 상태에서 읽고, 받은 단계 수를 들고
 * 다니며, 받을 수 있는 단계를 한 번에 걷는다. 지급과 저장은 서버 경계(`FakeServer.claimAchievementRewards`)가 한다.
 */

export type AchievementFacts = Record<AchievementMetric, number>;

/**
 * 상태에서 업적이 읽는 값을 한 번에 모은다.
 *
 * **상태가 이미 말하는 것은 상태에서 읽는다**(보유·레벨·돌파·유대·클리어·원정 최고). 업적을 늦게
 * 들였어도 지금까지 해 온 만큼이 그대로 선다. 누적 횟수(승리·연구·급여…)만 상태에 남지 않아
 * 임무 사건의 누적 기록(`MissionState.lifetime`)을 읽는다 — 그 값은 도입 뒤부터 센다.
 */
export function achievementFacts(state: Session): AchievementFacts {
  const lifetime = state.missions.lifetime ?? {};
  const playable = PLAYABLE_RELICS.filter(({ id }) => state.owned.has(id));
  const progress = playable.map(({ id }) => state.relicProgress[id]).filter((entry) => entry !== undefined);
  const maxBreakthrough = BREAKTHROUGH_STEPS.length;
  const storyStageIds = CHAPTERS.flatMap(({ stages }) => stages.map(({ id }) => id));
  const levelCap = relicLevelCap(maxBreakthrough);
  const ownedDefs = playable;
  const runes = state.runeInventory ?? [];
  const partyDefs = state.party.map((id) => PLAYABLE_RELICS.find((relic) => relic.id === id)).filter((relic) => relic !== undefined);
  const partyFull = partyDefs.length === 3;
  const reachedDuel = (state.duel?.reachedTierIds ?? []).map((id) => DUEL_TIERS.findIndex((tier) => tier.id === id));
  const bountyIds = new Set(BOUNTY_TIERS.map(({ id }) => id));
  return {
    ancientFloorPeak: Math.max(state.achievements?.ancientFloorPeak ?? 0, ancientHighestCleared(state.cleared, ANCIENT_STRATA_MAX_FLOOR)),
    normalStagesCleared: storyStageIds.filter((id) => state.cleared.has(`normal:${id}`)).length,
    hardStagesCleared: storyStageIds.filter((id) => state.cleared.has(`hard:${id}`)).length,
    enhancedRunes: runes.filter((rune) => rune.enhancementComplete).length,
    traitRunes: runes.filter((rune) => rune.trait !== undefined).length,
    legendaryTraits: runes.filter((rune) => rune.trait?.grade === "legendary").length,
    goldPeak: Math.max(state.achievements?.goldPeak ?? 0, state.wallet.gold),
    relicsOwned: playable.length,
    maxRelicLevel: progress.reduce((best, entry) => Math.max(best, entry.level), 0),
    relicsMaxBreakthrough: progress.filter((entry) => entry.breakthrough >= maxBreakthrough).length,
    relicsMaxBond: progress.filter((entry) => entry.bondLevel >= BOND_LEVEL_CAP).length,
    playerLevel: state.playerResearch.level,
    victories: lifetime.battle_completed ?? 0,
    storyStagesCleared: storyStageIds.filter((id) => state.cleared.has(id)).length,
    duelWins: lifetime.duel_won ?? 0,
    raidRuns: state.progressPasses?.raidRuns ?? 0,
    expeditionBest: Math.max(state.expedition.allTimeBestScore ?? 0, state.expedition.bestScore ?? 0),
    researchPulls: lifetime.relic_research_completed ?? 0,
    harvests: lifetime.excavation_harvested ?? 0,
    dispatches: lifetime.interaction_dispatched ?? 0,
    storiesRead: RECOLLECTION_ENTRIES.filter(({ storyId }) => state.completedStoryIds.has(storyId)).length,
    feedings: lifetime.salary_given ?? 0,
    staminaSpent: lifetime.stamina_spent ?? 0,
    dailyMissionsClaimed: lifetime.daily_mission_claimed ?? 0,
    lobbyGreetings: lifetime.lobby_interaction ?? 0,
    relicsAtLevelCap: progress.filter((entry) => entry.level >= levelCap).length,
    runesEngraved: runes.filter((rune) => rune.engravings.length > 0).length,
    bountyTiersCleared: new Set((state.bounty?.clearedTierIds ?? []).filter((id) => bountyIds.has(id))).size,
    cakeTiersCleared: Math.max(0, (state.cakeOperation?.clearedIndex ?? -1) + 1),
    duelTierReached: Math.max(0, ...reachedDuel),
    archaeologySitesCompleted: new Set(state.archaeology?.completedSiteIds ?? []).size,
    observationAnswers: state.relicStory?.answers.length ?? 0,
    relicChaptersRead: state.relicStory?.claimedChapterIds.length ?? 0,
    journalsRead: state.readInteractionJournalIds.size,
    ssrOwned: ownedDefs.filter(({ rarity }) => rarity === "SSR").length,
    runesOwned: runes.length,
    legendaryRunes: runes.filter(({ rarity }) => rarity === "legendary").length,
    modifiersEarned: new Set(state.earnedProfileModifierIds).size,
    // 도감 완성은 개체가 늘면 다시 닫힌다 — 다만 이미 받은 기록은 저장이 지킨다.
    codexComplete: PLAYABLE_RELICS.length > 0 && playable.length === PLAYABLE_RELICS.length ? 1 : 0,
    elementsOwned: new Set(ownedDefs.map(({ element }) => element)).size,
    squadsOwned: new Set(ownedDefs.map(({ squad }) => squad)).size,
    perfectRelics: progress.filter((entry) => entry.level >= levelCap && entry.breakthrough >= maxBreakthrough && entry.bondLevel >= BOND_LEVEL_CAP).length,
    fullyRunedRelics: progress.filter((entry) => entry.heartGemSlots.length > 0 && entry.heartGemSlots.every((slot) => slot !== null)).length,
    // 편성 장난은 지금 세워 둔 편성에서 읽는다 — 세 칸이 다 찼을 때만 센다.
    partySameElement: partyFull && new Set(partyDefs.map(({ element }) => element)).size === 1 ? 1 : 0,
    partySquads: partyFull ? new Set(partyDefs.map(({ squad }) => squad)).size : 0,
    partySsr: partyFull ? partyDefs.filter(({ rarity }) => rarity === "SSR").length : 0,
    nicknameSet: state.playerCard?.nickname ? 1 : 0,
  };
}

/** 그 값으로 닿은 단계 수(앞에서부터 이어지는 만큼). */
export function achievedTierCount(series: AchievementSeries, value: number): number {
  let count = 0;
  for (const tier of series.tiers) { if (value < tier.target) break; count += 1; }
  return count;
}

/** 닿았지만 아직 받지 않은 단계 수. */
export function claimableTierCount(series: AchievementSeries, value: number, claimed: number): number {
  return Math.max(0, achievedTierCount(series, value) - claimed);
}

export function claimableAchievementCount(state: AchievementState, facts: AchievementFacts): number {
  return ACHIEVEMENT_SERIES.reduce((sum, series) => sum + claimableTierCount(series, facts[series.metric], state.claimed[series.id] ?? 0), 0);
}

export interface AchievementClaim {
  state: AchievementState;
  /** 업적별로 이번에 받은 단계 번호(0부터). */
  claimedTiers: Record<string, number[]>;
  /** 이번 수령으로 마지막 단계까지 받은 업적 — 수식어를 여는 조건이다. */
  completedSeriesIds: string[];
  rewards: MissionReward[];
}

/**
 * 닿은 단계를 **차례대로 모두** 받는다. 한 업적에서 세 단계가 한꺼번에 열려 있으면 셋을 함께 준다 —
 * 한 번에 하나씩만 받게 하면 늦게 들어온 사람이 같은 버튼을 단계 수만큼 눌러야 한다.
 */
export function claimAchievements(state: AchievementState, facts: AchievementFacts, seriesIds?: readonly string[]): AchievementClaim {
  const requested = seriesIds ? new Set(seriesIds) : undefined;
  const claimed = { ...state.claimed };
  const claimedTiers: Record<string, number[]> = {};
  const completedSeriesIds: string[] = [];
  const rewards: MissionReward[] = [];
  for (const series of ACHIEVEMENT_SERIES) {
    if (requested && !requested.has(series.id)) continue;
    const already = claimed[series.id] ?? 0;
    const reached = achievedTierCount(series, facts[series.metric]);
    if (reached <= already) continue;
    claimedTiers[series.id] = [];
    for (let index = already; index < reached; index += 1) {
      claimedTiers[series.id].push(index);
      rewards.push(series.tiers[index].reward);
    }
    claimed[series.id] = reached;
    if (reached === series.tiers.length) completedSeriesIds.push(series.id);
  }
  return { state: { ...state, claimed }, claimedTiers, completedSeriesIds, rewards: mergeMissionRewards(rewards) };
}

/** 모든 업적을 끝까지 받았을 때의 재화 합. 젬 예산을 재는 테스트와 화면의 총계가 같은 값을 읽는다. */
export function achievementRewardTotals(): MissionReward[] {
  return mergeMissionRewards(ACHIEVEMENT_SERIES.flatMap((series) => series.tiers.map(({ reward }) => reward)));
}
