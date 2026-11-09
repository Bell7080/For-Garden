import { NEWBIE_GROWTH_DAYS, NEWBIE_GROWTH_GOAL_GEMS, NEWBIE_GROWTH_GOALS, NEWBIE_GROWTH_MILESTONES, NEWBIE_GROWTH_WINDOW_DAYS, type NewbieGrowthExtraMetric, type NewbieGrowthGoal, type NewbieGrowthMetric, type NewbieGrowthMilestone } from "../data/newbieGrowth";
import { STANDARD_POOLS } from "../data/banners";
import type { AchievementFacts } from "./achievements";
import type { AchievementState } from "./achievementState";
import type { MissionReward } from "./missions";

/**
 * 신규 7일 성장 가이드의 순수 규칙 — 계정이 몇째 날인지, 어느 목표가 열렸고 닿았고 받았는지, 무엇을 받을 수 있는지.
 * 지급과 저장은 서버 경계(`FakeServer.claimNewbieGrowth`)가 하고, 화면은 그 응답을 그리기만 한다.
 */

const DAY_MS = 86_400_000;

export type NewbieGrowthFacts = Record<NewbieGrowthMetric, number>;

/** 업적 값에 이 이벤트만 읽는 세 값을 얹는다. 첫 한계 돌파는 돌파 단계가 하나라도 오른 렐릭 수다. */
export function newbieGrowthFacts(facts: AchievementFacts, achievements: AchievementState, relicsBrokenThrough: number): NewbieGrowthFacts {
  const extra: Record<NewbieGrowthExtraMetric, number> = {
    favoriteChosen: achievements.favoriteChosen ? 1 : 0,
    guildJoined: achievements.guildJoined ? 1 : 0,
    relicsBrokenThrough,
  };
  return { ...facts, ...extra };
}

export interface NewbieGrowthWindow {
  /** 이벤트가 서 있는가 — 계정 생성부터 14일. */
  active: boolean;
  /** 지금 열린 마지막 날(1~7). 이벤트가 닫혔으면 0. */
  day: number;
  /** 다음 날이 열리는 시각(이레를 다 열었으면 없다). */
  nextDayAt?: string;
  endsAt: string;
}

export function newbieGrowthWindow(createdAt: string | undefined, now: Date): NewbieGrowthWindow {
  const start = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isFinite(start)) return { active: false, day: 0, endsAt: new Date(0).toISOString() };
  const elapsed = Math.max(0, now.getTime() - start);
  const end = start + NEWBIE_GROWTH_WINDOW_DAYS * DAY_MS;
  const active = now.getTime() < end;
  const day = active ? Math.min(NEWBIE_GROWTH_DAYS, Math.floor(elapsed / DAY_MS) + 1) : 0;
  return { active, day, ...(active && day < NEWBIE_GROWTH_DAYS ? { nextDayAt: new Date(start + day * DAY_MS).toISOString() } : {}), endsAt: new Date(end).toISOString() };
}

export type NewbieGrowthGoalState = "locked" | "progress" | "claimable" | "claimed";

export function newbieGrowthGoalState(goal: NewbieGrowthGoal, facts: NewbieGrowthFacts, claimed: ReadonlySet<string>, openDay: number): NewbieGrowthGoalState {
  if (claimed.has(goal.id)) return "claimed";
  if (goal.day > openDay) return "locked";
  return facts[goal.metric] >= goal.target ? "claimable" : "progress";
}

export function newbieGrowthClaimedGoalCount(claimed: ReadonlySet<string>): number {
  return NEWBIE_GROWTH_GOALS.filter(({ id }) => claimed.has(id)).length;
}

export type NewbieGrowthMilestoneState = "progress" | "claimable" | "claimed";

export function newbieGrowthMilestoneState(milestone: NewbieGrowthMilestone, claimed: ReadonlySet<string>): NewbieGrowthMilestoneState {
  if (claimed.has(milestone.id)) return "claimed";
  return newbieGrowthClaimedGoalCount(claimed) >= milestone.goals ? "claimable" : "progress";
}

/** 받을 것이 남은 칸 수 — 로비 이벤트 판의 빨간 점과 알림 신호가 읽는다. */
export function newbieGrowthClaimableCount(facts: NewbieGrowthFacts, claimed: ReadonlySet<string>, openDay: number): number {
  const goals = NEWBIE_GROWTH_GOALS.filter((goal) => newbieGrowthGoalState(goal, facts, claimed, openDay) === "claimable").length;
  const milestones = NEWBIE_GROWTH_MILESTONES.filter((milestone) => newbieGrowthMilestoneState(milestone, claimed) === "claimable").length;
  return goals + milestones;
}

export interface NewbieGrowthClaim {
  goalIds: string[];
  milestoneIds: string[];
  rewards: MissionReward[];
  /** SR 선택권 마디를 이번에 받는가 — 고른 렐릭은 서버가 따로 검증해 지급한다. */
  srSelect: boolean;
}

/**
 * 받을 수 있는 것을 걷는다. `goalIds`를 주면 그 목표만, 주지 않으면 닿은 목표를 모두 걷는다. 목표를 받아 문턱을 넘은 마디는
 * 같은 요청에서 함께 걷는다 — 다만 SR 선택권은 고를 렐릭(`includeSrSelect`)이 함께 왔을 때만 걷는다.
 */
export function claimNewbieGrowth(facts: NewbieGrowthFacts, claimed: ReadonlySet<string>, openDay: number, options: { goalIds?: readonly string[]; includeSrSelect?: boolean } = {}): NewbieGrowthClaim {
  const requested = options.goalIds ? new Set(options.goalIds) : undefined;
  const next = new Set(claimed);
  const goalIds: string[] = [];
  for (const goal of NEWBIE_GROWTH_GOALS) {
    if (requested && !requested.has(goal.id)) continue;
    if (newbieGrowthGoalState(goal, facts, next, openDay) !== "claimable") continue;
    next.add(goal.id);
    goalIds.push(goal.id);
  }
  const rewards: MissionReward[] = goalIds.length > 0 ? [{ currency: "gems", amount: goalIds.length * NEWBIE_GROWTH_GOAL_GEMS }] : [];
  const milestoneIds: string[] = [];
  let srSelect = false;
  for (const milestone of NEWBIE_GROWTH_MILESTONES) {
    if (newbieGrowthMilestoneState(milestone, next) !== "claimable") continue;
    if (milestone.reward.kind === "srSelect") {
      if (!options.includeSrSelect) continue;
      srSelect = true;
    } else rewards.push({ currency: milestone.reward.currency, amount: milestone.reward.amount });
    next.add(milestone.id);
    milestoneIds.push(milestone.id);
  }
  return { goalIds, milestoneIds, rewards, srSelect };
}

/** SR 선택권으로 고를 수 있는 렐릭 — 상시 연구의 SR 풀(한정 렐릭 제외)과 같다. */
export function newbieGrowthSrChoices(): readonly string[] {
  return STANDARD_POOLS.SR;
}
