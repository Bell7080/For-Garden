import type { AchievementMetric } from "./achievements";
import type { WalletItemKey } from "./items";

/**
 * 신규 연구원 7일 성장 가이드 — **하나의 이벤트**(응태 결정 2026-11-09).
 *
 * 계정이 선 순간부터 14일 동안 로비 이벤트 판에 서고, 하루에 다섯 목표가 열려 이레 동안 서른다섯 목표가 된다.
 * 목표는 업적이 이미 읽는 값(`achievementFacts`)을 그대로 쓰고, 그 밖에는 셋만 더한다 — 애착 렐릭 정하기 · 길드 가입 ·
 * 첫 한계 돌파. 차례는 콘텐츠 해금(`CONTENT_UNLOCKS`)을 따라가 그날 열린 목표가 그날 손닿는 곳에 있게 짰다.
 *
 * 보상(승인 2026-11-09, 응태 재구성 2026-11-11): 목표 보상은 **치즈케이크 위주**다 — 날마다 넷은 치즈케이크(60~100, 뒤로 갈수록
 * 오른다), 다섯째는 젬 100. 1일차 첫 목표만 치즈케이크 대신 **토리카 파편 1개**다(가이드가 토리카라 첫날 그 아이의 한계 돌파를
 * 한 걸음 당겨 준다). 누적 마일스톤은 10개 화석 3 · 20개 호박석 3 · 30개 화석 5 · 35개 **SR 렐릭 선택권**(가방 아이템 그대로 —
 * 가방에서 쓰면 같은 고르기 창이 연다).
 * 재화 몫은 치즈케이크 2,100(젬 1,050) + 젬 700 + 화석 8 · 호박석 3(젬 3,300) = 젬 환산 5,050으로 승인 예산과 같다. 토리카 파편과
 * SR 선택권은 응태가 고른 덤이라 이 셈 밖이다. 예산은 `EVENT_REWARD_BUDGET.limited["newbie-growth"]`.
 *
 * 이 파일은 저장 검증(`achievementState.ts`)이 읽으므로 무거운 표를 import하지 않는다.
 */

export const NEWBIE_GROWTH_ID = "newbie-growth";
/** 하루에 열리는 목표의 날 수. */
export const NEWBIE_GROWTH_DAYS = 7;
/** 계정 생성부터 이벤트가 서 있는 날 수 — 이레를 다 연 뒤에도 남은 목표를 마저 할 이레를 더 준다. */
export const NEWBIE_GROWTH_WINDOW_DAYS = 14;
/** 마지막 마디가 주는 가방 아이템 — 첫 결제 선물과 같은 SR 렐릭 선택권이다. */
export const NEWBIE_GROWTH_SR_TICKET = "sr-select-ticket";
/** 1일차 첫 목표가 주는 파편의 주인 — 가이드에 서는 토리카. */
export const NEWBIE_GROWTH_GUIDE_RELIC = "torika";

/** 업적 값 밖에서 이 이벤트만 읽는 세 값. */
export type NewbieGrowthExtraMetric = "favoriteChosen" | "guildJoined" | "relicsBrokenThrough";
export type NewbieGrowthMetric = AchievementMetric | NewbieGrowthExtraMetric;

/** 목표·마디 한 칸의 보상 — 재화, 가방 아이템, 그 렐릭의 파편 중 하나다. */
export type NewbieGrowthReward =
  | { readonly kind: "currency"; readonly currency: WalletItemKey; readonly amount: number }
  | { readonly kind: "item"; readonly itemId: string; readonly amount: number }
  | { readonly kind: "fragment"; readonly relicId: string; readonly amount: number };

export interface NewbieGrowthGoal { readonly id: string; readonly day: number; readonly metric: NewbieGrowthMetric; readonly target: number; readonly reward: NewbieGrowthReward }

const DAY_GOALS: ReadonlyArray<ReadonlyArray<readonly [NewbieGrowthMetric, number]>> = [
  [["storyStagesCleared", 5], ["favoriteChosen", 1], ["feedings", 3], ["researchPulls", 10], ["harvests", 1]],
  [["storyStagesCleared", 10], ["maxRelicLevel", 10], ["archaeologySitesCompleted", 1], ["dailyMissionsClaimed", 5], ["staminaSpent", 100]],
  [["storyStagesCleared", 15], ["maxRelicLevel", 15], ["cakeTiersCleared", 1], ["bountyTiersCleared", 1], ["runesOwned", 3]],
  [["storyStagesCleared", 20], ["maxRelicLevel", 20], ["playerLevel", 7], ["dispatches", 1], ["observationAnswers", 1]],
  [["storyStagesCleared", 25], ["guildJoined", 1], ["relicsBrokenThrough", 1], ["enhancedRunes", 1], ["duelWins", 1]],
  [["maxRelicLevel", 25], ["raidRuns", 1], ["researchPulls", 20], ["staminaSpent", 600], ["archaeologySitesCompleted", 3]],
  [["storyStagesCleared", 30], ["ancientFloorPeak", 5], ["maxRelicLevel", 30], ["playerLevel", 15], ["researchPulls", 30]],
];

/** 날마다 치즈케이크 목표 한 칸의 양 — 뒤로 갈수록 급여 값이 커지는 만큼 오른다. */
const DAY_CHEESECAKE: readonly number[] = [60, 60, 70, 80, 80, 90, 100];
/** 날마다 마지막 목표의 젬. */
const DAY_GEMS = 100;

const cheesecake = (amount: number): NewbieGrowthReward => ({ kind: "currency", currency: "cheesecake", amount });

function goalReward(day: number, order: number): NewbieGrowthReward {
  if (day === 1 && order === 0) return { kind: "fragment", relicId: NEWBIE_GROWTH_GUIDE_RELIC, amount: 1 };
  if (order === 4) return { kind: "currency", currency: "gems", amount: DAY_GEMS };
  return cheesecake(DAY_CHEESECAKE[day - 1]);
}

export const NEWBIE_GROWTH_GOALS: readonly NewbieGrowthGoal[] = DAY_GOALS.flatMap((goals, index) =>
  goals.map(([metric, target], order) => ({ id: `d${index + 1}-${order + 1}`, day: index + 1, metric, target, reward: goalReward(index + 1, order) })));

export type NewbieGrowthMilestoneReward = NewbieGrowthReward;

export interface NewbieGrowthMilestone { readonly id: string; readonly goals: number; readonly reward: NewbieGrowthMilestoneReward }

/** 받은 목표 수로 열리는 마디. 마지막이 서른다섯 — 모두 받은 사람에게 SR 렐릭 선택권을 준다. */
export const NEWBIE_GROWTH_MILESTONES: readonly NewbieGrowthMilestone[] = [
  { id: "m10", goals: 10, reward: { kind: "currency", currency: "fossil", amount: 3 } },
  { id: "m20", goals: 20, reward: { kind: "currency", currency: "amber", amount: 3 } },
  { id: "m30", goals: 30, reward: { kind: "currency", currency: "fossil", amount: 5 } },
  { id: "m35", goals: 35, reward: { kind: "item", itemId: NEWBIE_GROWTH_SR_TICKET, amount: 1 } },
];

export const NEWBIE_GROWTH_CLAIM_IDS: ReadonlySet<string> = new Set([...NEWBIE_GROWTH_GOALS.map(({ id }) => id), ...NEWBIE_GROWTH_MILESTONES.map(({ id }) => id)]);
