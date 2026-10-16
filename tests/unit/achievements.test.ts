import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { achievementFacts, achievementRewardTotals, claimAchievements, createEmptyAchievementState, isValidAchievementState, normalizeAchievementState } from "../../src/core/achievements";
import { applyMissionEvent } from "../../src/core/missions";
import { ACHIEVEMENT_GEM_BUDGET, ACHIEVEMENT_SERIES } from "../../src/data/achievements";
import { PROFILE_MODIFIERS } from "../../src/data/profileModifiers";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { KO } from "../../src/i18n/ko";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type Session } from "../../src/state/session";

const NOW = new Date("2026-10-16T09:00:00.000Z");

describe("업적 표", () => {
  it("의 단계는 오르막이고 업적 ID는 겹치지 않는다", () => {
    expect(new Set(ACHIEVEMENT_SERIES.map(({ id }) => id)).size).toBe(ACHIEVEMENT_SERIES.length);
    for (const series of ACHIEVEMENT_SERIES) {
      // 기록(단발)만 한 단계이고, 나머지는 점점 어려워지는 셋 이상의 단계다.
      if (series.category === "feat") expect(series.tiers.length, series.id).toBe(1);
      else expect(series.tiers.length, series.id).toBeGreaterThanOrEqual(3);
      series.tiers.forEach((tier, index) => {
        expect(tier.reward.amount, series.id).toBeGreaterThan(0);
        if (index > 0) expect(tier.target, series.id).toBeGreaterThan(series.tiers[index - 1].target);
      });
    }
  });

  it("의 젬은 모든 업적을 끝까지 밟아도 예산 띠 안이다 — 업적은 덤이지 수급처가 아니다", () => {
    const gems = achievementRewardTotals().find(({ currency }) => currency === "gems")?.amount ?? 0;
    expect(gems).toBeGreaterThan(ACHIEVEMENT_GEM_BUDGET * 0.6);
    expect(gems).toBeLessThanOrEqual(ACHIEVEMENT_GEM_BUDGET);
    // 한 단계가 연구 한 번(젬 300)의 3분의 1을 넘지 않는다.
    for (const series of ACHIEVEMENT_SERIES) for (const tier of series.tiers) if (tier.reward.currency === "gems") expect(tier.reward.amount).toBeLessThanOrEqual(100);
  });

  it("의 수식어는 그 업적의 마지막 단계가 연다", () => {
    for (const series of ACHIEVEMENT_SERIES) {
      if (!series.modifierId) continue;
      const modifier = PROFILE_MODIFIERS.find(({ id }) => id === series.modifierId);
      expect(modifier?.acquisitionConditionId, series.id).toBe(`achievement:${series.id}`);
    }
    // 백만장자는 1억 골드에서 열린다.
    const wealth = ACHIEVEMENT_SERIES.find(({ id }) => id === "wealth")!;
    expect(wealth.tiers.at(-1)!.target).toBe(100_000_000);
    expect(wealth.modifierId).toBe("millionaire");
  });

  it("의 모든 업적은 이름과 목표 문구를 갖는다", () => {
    for (const series of ACHIEVEMENT_SERIES) {
      expect(KO[`achievement.series.${series.id}` as keyof typeof KO], series.id).toBeTruthy();
      const objective = KO[`achievement.objective.${series.metric}` as keyof typeof KO];
      expect(objective, series.metric).toBeTruthy();
      // 단계가 오르는 업적은 문턱을 문장에 넣는다. 단발 기록만 "도감 완성"처럼 수 없이 말해도 된다.
      if (series.category !== "feat") expect(objective, series.metric).toContain("{value}");
    }
  });
});

describe("업적 수령", () => {
  it("은 닿은 단계를 차례로 모두 받고, 끝난 업적을 알린다", () => {
    const facts = achievementFacts(createDefaultSession());
    const claim = claimAchievements(createEmptyAchievementState(), { ...facts, goldPeak: 150_000_000 }, ["wealth"]);
    expect(claim.claimedTiers.wealth).toEqual([0, 1, 2, 3, 4]);
    expect(claim.completedSeriesIds).toEqual(["wealth"]);
    expect(claim.rewards).toEqual([{ currency: "gems", amount: 155 }]);
    // 다시 받으면 아무것도 없다.
    const again = claimAchievements(claim.state, { ...facts, goldPeak: 150_000_000 }, ["wealth"]);
    expect(again.rewards).toEqual([]);
  });

  it("의 저장 모양은 손상된 값을 걸러 낸다", () => {
    expect(normalizeAchievementState({ claimed: { wealth: 99, ghost: 2, collector: -1 }, goldPeak: 12.5 })).toEqual({ claimed: { wealth: 5 }, goldPeak: 0 });
    expect(isValidAchievementState({ claimed: { wealth: 6 }, goldPeak: 0 })).toBe(false);
    expect(isValidAchievementState(createEmptyAchievementState())).toBe(true);
  });

  it("의 누적 기록은 기간이 바뀌어도 남는다", () => {
    let missions = createDefaultSession().missions;
    missions = applyMissionEvent(missions, { type: "battle_completed", victory: true }, NOW);
    missions = applyMissionEvent(missions, { type: "battle_completed", victory: false }, NOW);
    missions = applyMissionEvent(missions, { type: "battle_completed", victory: true }, new Date("2026-10-30T09:00:00.000Z"));
    expect(missions.lifetime?.battle_completed).toBe(2);
  });
});

describe("단발 기록", () => {
  it("은 지금 편성과 보유에서 읽고, 숨은 편성 기록은 신규 계정의 기본 편성으로 밟지 못한다", () => {
    const fresh = achievementFacts(createDefaultSession());
    for (const series of ACHIEVEMENT_SERIES.filter(({ hidden }) => hidden)) expect(fresh[series.metric], series.id).toBeLessThan(series.tiers[0].target);
    const state = createDefaultSession();
    const relics = PLAYABLE_RELICS;
    const picks: string[] = [];
    for (const relic of relics) if (!picks.some((id) => relics.find((r) => r.id === id)!.squad === relic.squad)) picks.push(relic.id);
    state.party = picks.slice(0, 3);
    for (const relic of relics) state.owned.add(relic.id);
    const facts = achievementFacts(state);
    expect(facts.partySquads).toBe(3);
    expect(facts.codexComplete).toBe(1);
    expect(facts.elementsOwned).toBe(5);
    expect(facts.squadsOwned).toBe(5);
    const claim = claimAchievements(createEmptyAchievementState(), facts, ["allied-party", "codex-complete"]);
    expect(claim.completedSeriesIds.sort()).toEqual(["allied-party", "codex-complete"]);
  });

  it("의 숨은 업적은 서버 응답이 숨김을 함께 내려 준다", async () => {
    const list = await new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => NOW, random: () => 0.5 }).getAchievements();
    expect(list.series.find(({ id }) => id === "allied-party")?.hidden).toBe(true);
    expect(list.series.find(({ id }) => id === "wealth")?.hidden).toBeUndefined();
  });
});

describe("업적 서버 경계", () => {
  const make = (state: Session) => new FakeServer(state, { latencyMs: 0, now: () => NOW, random: () => 0.5 });

  it("은 최고 보유 골드를 기억해, 골드를 쓴 뒤에도 업적이 뒤로 가지 않는다", async () => {
    const state = createDefaultSession();
    state.wallet.gold = 120_000;
    const api = make(state);
    await api.interactInLobby(state.favorite).catch(() => undefined);
    await api.getMissions();
    state.wallet.gold = 10;
    const list = await api.getAchievements();
    expect(list.series.find(({ id }) => id === "wealth")?.value).toBeGreaterThanOrEqual(120_000);
  });

  it("은 단계 보상을 지급하고 마지막 단계에서 수식어를 연다", async () => {
    const state = createDefaultSession();
    state.wallet.gold = 100_000_000;
    const api = make(state);
    const gemsBefore = state.wallet.gems;
    const result = await api.claimAchievementRewards(["wealth"]);
    expect(result.claimedTiers.wealth).toHaveLength(5);
    expect(result.newModifierIds).toEqual(["millionaire"]);
    expect(state.wallet.gems).toBe(gemsBefore + 155);
    expect(state.earnedProfileModifierIds).toContain("millionaire");
    await expect(api.claimAchievementRewards(["wealth"])).rejects.toMatchObject({ code: "NOTHING_TO_CLAIM" });
    const list = await api.getAchievements();
    const wealth = list.series.find(({ id }) => id === "wealth")!;
    expect(wealth.claimedTiers).toBe(5);
    expect(wealth.modifier).toEqual({ id: "millionaire", earned: true });
  });

  it("의 기록은 저장을 지나도 남는다", () => {
    const state = createDefaultSession();
    state.achievements = { claimed: { wealth: 2 }, goldPeak: 345_000 };
    state.missions = { ...state.missions, lifetime: { battle_completed: 7 } };
    const saves = new SaveManager(undefined);
    const restored = saves.parse(JSON.parse(JSON.stringify(saves.exportData(state))));
    expect(restored.achievements).toEqual({ claimed: { wealth: 2 }, goldPeak: 345_000 });
    expect(restored.missions.lifetime).toEqual({ battle_completed: 7 });
  });
});
