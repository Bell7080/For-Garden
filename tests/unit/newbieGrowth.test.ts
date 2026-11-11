import { describe, expect, it } from "vitest";
import { NEWBIE_GROWTH_CLAIM_IDS, NEWBIE_GROWTH_DAYS, NEWBIE_GROWTH_GOALS, NEWBIE_GROWTH_GUIDE_RELIC, NEWBIE_GROWTH_MILESTONES, NEWBIE_GROWTH_SR_TICKET, NEWBIE_GROWTH_WINDOW_DAYS, type NewbieGrowthReward } from "../../src/data/newbieGrowth";
import { claimNewbieGrowth, newbieGrowthClaimableCount, newbieGrowthGoalState, newbieGrowthWindow, type NewbieGrowthFacts } from "../../src/core/newbieGrowth";
import { findItem } from "../../src/data/items";
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

  it("재화 몫의 총량은 승인한 한정 이벤트 예산(젬 5,050)과 같다", () => {
    const gemValue = (reward: NewbieGrowthReward): number => reward.kind === "currency" ? reward.amount / (TRADE_GEM_RATE as Record<string, number>)[reward.currency] : 0;
    const total = [...NEWBIE_GROWTH_GOALS.map(({ reward }) => reward), ...NEWBIE_GROWTH_MILESTONES.map(({ reward }) => reward)].reduce((sum, reward) => sum + gemValue(reward), 0);
    expect(total).toBe(EVENT_REWARD_BUDGET.limited["newbie-growth"].totalGemValue);
  });

  it("목표 보상은 치즈케이크 위주이고, 1일차 첫 목표는 토리카 파편 1개다", () => {
    const cheesecake = NEWBIE_GROWTH_GOALS.filter(({ reward }) => reward.kind === "currency" && reward.currency === "cheesecake");
    expect(cheesecake.length).toBeGreaterThan(NEWBIE_GROWTH_GOALS.length / 2);
    expect(NEWBIE_GROWTH_GOALS[0]).toMatchObject({ id: "d1-1", reward: { kind: "fragment", relicId: NEWBIE_GROWTH_GUIDE_RELIC, amount: 1 } });
    expect(NEWBIE_GROWTH_GOALS.filter(({ reward }) => reward.kind === "fragment")).toHaveLength(1);
    expect(RELICS.find(({ id }) => id === NEWBIE_GROWTH_GUIDE_RELIC)).toBeDefined();
  });

  it("마지막 마디는 서른다섯 목표의 SR 렐릭 선택권(가방 아이템)이다", () => {
    const last = NEWBIE_GROWTH_MILESTONES.at(-1)!;
    expect(last.goals).toBe(35);
    expect(last.reward).toEqual({ kind: "item", itemId: NEWBIE_GROWTH_SR_TICKET, amount: 1 });
    expect(findItem(NEWBIE_GROWTH_SR_TICKET)?.useEffect).toEqual({ kind: "select_relic", rarity: "SR" });
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

  it("목표를 받으면 넘은 마디를 함께 걷고 같은 보상은 합친다", () => {
    const facts = maxedFacts();
    const first = claimNewbieGrowth(facts, new Set(), 7);
    expect(first.goalIds).toHaveLength(35);
    expect(first.milestoneIds).toEqual(["m10", "m20", "m30", "m35"]);
    expect(first.rewards.find(({ currency }) => currency === "cheesecake")?.amount).toBe(2_100);
    expect(first.rewards.find(({ currency }) => currency === "gems")?.amount).toBe(700);
    expect(first.rewards.find(({ currency }) => currency === "fossil")?.amount).toBe(8);
    expect(first.items).toEqual([{ itemId: NEWBIE_GROWTH_SR_TICKET, amount: 1 }]);
    expect(first.fragments).toEqual([{ relicId: NEWBIE_GROWTH_GUIDE_RELIC, amount: 1 }]);
    const claimed = new Set([...first.goalIds, ...first.milestoneIds]);
    expect(claimNewbieGrowth(facts, claimed, 7)).toMatchObject({ goalIds: [], milestoneIds: [], rewards: [], items: [], fragments: [] });
  });

  it("1일차 첫 목표만 받으면 토리카 파편 하나만 들어온다", () => {
    expect(claimNewbieGrowth(maxedFacts(), new Set(), 1, { goalIds: ["d1-1"] })).toMatchObject({ goalIds: ["d1-1"], rewards: [], items: [], fragments: [{ relicId: NEWBIE_GROWTH_GUIDE_RELIC, amount: 1 }] });
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
