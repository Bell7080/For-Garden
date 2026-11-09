import { describe, expect, it } from "vitest";
import { NEWBIE_GROWTH_CLAIM_IDS, NEWBIE_GROWTH_DAYS, NEWBIE_GROWTH_GOAL_GEMS, NEWBIE_GROWTH_GOALS, NEWBIE_GROWTH_MILESTONES, NEWBIE_GROWTH_WINDOW_DAYS } from "../../src/data/newbieGrowth";
import { claimNewbieGrowth, newbieGrowthClaimableCount, newbieGrowthGoalState, newbieGrowthSrChoices, newbieGrowthWindow, type NewbieGrowthFacts } from "../../src/core/newbieGrowth";
import { EVENT_REWARD_BUDGET } from "../../src/core/eventRewardBudget";
import { TRADE_GEM_RATE } from "../../src/data/tradePackages";
import { RELICS } from "../../src/data/relics";
import { normalizeAchievementState } from "../../src/core/achievementState";
import { NEWBIE_GROWTH_LAYOUT, newbieGrowthDayX, newbieGrowthRowY } from "../../src/ui/newbieGrowthLayout";
import { KO as ko } from "../../src/i18n/ko";

const DAY = 86_400_000;

/** 모든 목표를 넘긴 사실 — 목표가 무엇을 재든 닿게 한다. */
function maxedFacts(): NewbieGrowthFacts {
  return new Proxy({}, { get: () => 1_000_000 }) as NewbieGrowthFacts;
}

describe("신규 7일 성장 가이드", () => {
  it("하루 다섯 목표씩 7일, 서른다섯 목표다", () => {
    expect(NEWBIE_GROWTH_GOALS).toHaveLength(35);
    for (let day = 1; day <= NEWBIE_GROWTH_DAYS; day += 1) expect(NEWBIE_GROWTH_GOALS.filter((goal) => goal.day === day)).toHaveLength(5);
    expect(new Set(NEWBIE_GROWTH_GOALS.map(({ id }) => id)).size).toBe(35);
  });

  it("애착 렐릭·길드 가입 목표가 들어 있다", () => {
    const metrics = NEWBIE_GROWTH_GOALS.map(({ metric }) => metric);
    expect(metrics).toContain("favoriteChosen");
    expect(metrics).toContain("guildJoined");
  });

  it("모든 목표 문구가 한국어 표에 있다", () => {
    for (const goal of NEWBIE_GROWTH_GOALS) {
      const extra = goal.metric === "favoriteChosen" || goal.metric === "guildJoined" || goal.metric === "relicsBrokenThrough";
      const key = extra ? `newbieGrowth.objective.${goal.metric}` : `achievement.objective.${goal.metric}`;
      expect(ko, key).toHaveProperty([key]);
    }
  });

  it("보상 총량은 승인한 한정 이벤트 예산(젬 5,050)과 같다", () => {
    const goalGems = NEWBIE_GROWTH_GOALS.length * NEWBIE_GROWTH_GOAL_GEMS;
    const milestoneGems = NEWBIE_GROWTH_MILESTONES.reduce((sum, { reward }) => {
      if (reward.kind !== "currency") return sum;
      const rate = (TRADE_GEM_RATE as Record<string, number>)[reward.currency];
      return sum + reward.amount / rate;
    }, 0);
    expect(goalGems + milestoneGems).toBe(EVENT_REWARD_BUDGET.limited["newbie-growth"].totalGemValue);
    expect(NEWBIE_GROWTH_MILESTONES.at(-1)?.reward.kind).toBe("srSelect");
    expect(NEWBIE_GROWTH_MILESTONES.at(-1)?.goals).toBe(35);
  });

  it("SR 선택권은 상시 SR 풀만 고른다", () => {
    const choices = newbieGrowthSrChoices();
    expect(choices.length).toBeGreaterThan(0);
    for (const id of choices) expect(RELICS.find((relic) => relic.id === id)?.rarity).toBe("SR");
  });

  it("하루씩 열리고 14일 뒤 닫힌다", () => {
    const created = "2026-11-01T00:00:00.000Z";
    const start = Date.parse(created);
    expect(newbieGrowthWindow(created, new Date(start + 1000))).toMatchObject({ active: true, day: 1 });
    expect(newbieGrowthWindow(created, new Date(start + DAY * 2.5))).toMatchObject({ active: true, day: 3 });
    expect(newbieGrowthWindow(created, new Date(start + DAY * 10))).toMatchObject({ active: true, day: 7 });
    expect(newbieGrowthWindow(created, new Date(start + DAY * NEWBIE_GROWTH_WINDOW_DAYS + 1)).active).toBe(false);
  });

  it("열리지 않은 날의 목표는 다 해도 받을 수 없다", () => {
    const facts = maxedFacts();
    const day2 = NEWBIE_GROWTH_GOALS.find((goal) => goal.day === 2)!;
    expect(newbieGrowthGoalState(day2, facts, new Set(), 1)).toBe("locked");
    expect(newbieGrowthClaimableCount(facts, new Set(), 1)).toBe(5);
  });

  it("목표를 받으면 넘은 마디를 함께 걷고, SR 선택권은 고를 렐릭이 올 때만 걷는다", () => {
    const facts = maxedFacts();
    const first = claimNewbieGrowth(facts, new Set(), 7);
    expect(first.goalIds).toHaveLength(35);
    expect(first.rewards.find(({ currency }) => currency === "gems")?.amount).toBe(35 * NEWBIE_GROWTH_GOAL_GEMS);
    expect(first.milestoneIds).toEqual(["m10", "m20", "m30"]);
    expect(first.srSelect).toBe(false);
    const claimed = new Set([...first.goalIds, ...first.milestoneIds]);
    const sr = claimNewbieGrowth(facts, claimed, 7, { includeSrSelect: true });
    expect(sr).toMatchObject({ goalIds: [], milestoneIds: ["m35"], srSelect: true, rewards: [] });
    expect(claimNewbieGrowth(facts, new Set([...claimed, "m35"]), 7, { includeSrSelect: true }).milestoneIds).toEqual([]);
  });

  it("저장은 모르는 받기 ID를 걷어 낸다", () => {
    const state = normalizeAchievementState({ claimed: {}, growth: ["d1-1", "m10", "nope"], favoriteChosen: true });
    expect(state.growth).toEqual(["d1-1", "m10"]);
    expect(state.favoriteChosen).toBe(true);
    expect(NEWBIE_GROWTH_CLAIM_IDS.has("nope")).toBe(false);
  });

  it("일차 칩과 목표 줄이 판 안에 서고 받기 버튼과 겹치지 않는다", () => {
    const { days, list, claim } = NEWBIE_GROWTH_LAYOUT;
    expect(newbieGrowthDayX(7) + days.width / 2 - (newbieGrowthDayX(1) - days.width / 2)).toBeLessThanOrEqual(list.cardWidth);
    expect(newbieGrowthRowY(4) + list.cardHeight / 2).toBeLessThan(claim.y - claim.height / 2);
    expect(days.y + days.height / 2).toBeLessThan(newbieGrowthRowY(0) - list.cardHeight / 2);
  });
});
