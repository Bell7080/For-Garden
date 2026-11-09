import type { AchievementMetric } from "./achievements";
import type { WalletItemKey } from "./items";

/**
 * 신규 연구원 7일 성장 가이드 — **하나의 이벤트**(응태 결정 2026-11-09).
 *
 * 계정이 선 순간부터 14일 동안 로비 이벤트 판에 서고, 하루에 다섯 목표가 열려 이레 동안 서른다섯 목표가 된다.
 * 목표는 업적이 이미 읽는 값(`achievementFacts`)을 그대로 쓰고, 그 밖에는 셋만 더한다 — 애착 렐릭 정하기 · 길드 가입 ·
 * 첫 한계 돌파. 차례는 콘텐츠 해금(`CONTENT_UNLOCKS`)을 따라가 그날 열린 목표가 그날 손닿는 곳에 있게 짰다.
 *
 * 보상(승인 2026-11-09): 목표마다 젬 50(35 × 50 = 1,750) · 누적 마일스톤 10개 화석 3 · 20개 호박석 3 · 30개 화석 5 ·
 * 35개 SR 선택권 — 젬 환산 5,050(화석·호박석 개당 300) + SR 한 명. 예산은 `EVENT_REWARD_BUDGET.limited["newbie-growth"]`.
 *
 * 이 파일은 저장 검증(`achievementState.ts`)이 읽으므로 무거운 표를 import하지 않는다.
 */

export const NEWBIE_GROWTH_ID = "newbie-growth";
/** 하루에 열리는 목표의 날 수. */
export const NEWBIE_GROWTH_DAYS = 7;
/** 계정 생성부터 이벤트가 서 있는 날 수 — 이레를 다 연 뒤에도 남은 목표를 마저 할 이레를 더 준다. */
export const NEWBIE_GROWTH_WINDOW_DAYS = 14;
export const NEWBIE_GROWTH_GOAL_GEMS = 50;

/** 업적 값 밖에서 이 이벤트만 읽는 세 값. */
export type NewbieGrowthExtraMetric = "favoriteChosen" | "guildJoined" | "relicsBrokenThrough";
export type NewbieGrowthMetric = AchievementMetric | NewbieGrowthExtraMetric;

export interface NewbieGrowthGoal { readonly id: string; readonly day: number; readonly metric: NewbieGrowthMetric; readonly target: number }

const DAY_GOALS: ReadonlyArray<ReadonlyArray<readonly [NewbieGrowthMetric, number]>> = [
  [["storyStagesCleared", 5], ["favoriteChosen", 1], ["feedings", 3], ["researchPulls", 10], ["harvests", 1]],
  [["storyStagesCleared", 10], ["maxRelicLevel", 10], ["archaeologySitesCompleted", 1], ["dailyMissionsClaimed", 5], ["staminaSpent", 100]],
  [["storyStagesCleared", 15], ["maxRelicLevel", 15], ["cakeTiersCleared", 1], ["bountyTiersCleared", 1], ["runesOwned", 3]],
  [["storyStagesCleared", 20], ["maxRelicLevel", 20], ["playerLevel", 7], ["dispatches", 1], ["observationAnswers", 1]],
  [["storyStagesCleared", 25], ["guildJoined", 1], ["relicsBrokenThrough", 1], ["enhancedRunes", 1], ["duelWins", 1]],
  [["maxRelicLevel", 25], ["raidRuns", 1], ["researchPulls", 20], ["staminaSpent", 600], ["archaeologySitesCompleted", 3]],
  [["storyStagesCleared", 30], ["ancientFloorPeak", 5], ["maxRelicLevel", 30], ["playerLevel", 15], ["researchPulls", 30]],
];

export const NEWBIE_GROWTH_GOALS: readonly NewbieGrowthGoal[] = DAY_GOALS.flatMap((goals, index) =>
  goals.map(([metric, target], order) => ({ id: `d${index + 1}-${order + 1}`, day: index + 1, metric, target })));

export type NewbieGrowthMilestoneReward = { readonly kind: "currency"; readonly currency: WalletItemKey; readonly amount: number } | { readonly kind: "srSelect" };

export interface NewbieGrowthMilestone { readonly id: string; readonly goals: number; readonly reward: NewbieGrowthMilestoneReward }

/** 받은 목표 수로 열리는 마디. 마지막이 서른다섯 — 모두 받은 사람에게 SR 한 명을 고르게 한다. */
export const NEWBIE_GROWTH_MILESTONES: readonly NewbieGrowthMilestone[] = [
  { id: "m10", goals: 10, reward: { kind: "currency", currency: "fossil", amount: 3 } },
  { id: "m20", goals: 20, reward: { kind: "currency", currency: "amber", amount: 3 } },
  { id: "m30", goals: 30, reward: { kind: "currency", currency: "fossil", amount: 5 } },
  { id: "m35", goals: 35, reward: { kind: "srSelect" } },
];

export const NEWBIE_GROWTH_CLAIM_IDS: ReadonlySet<string> = new Set([...NEWBIE_GROWTH_GOALS.map(({ id }) => id), ...NEWBIE_GROWTH_MILESTONES.map(({ id }) => id)]);
