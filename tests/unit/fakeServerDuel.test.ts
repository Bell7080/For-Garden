import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createEmptyRaidState, createInitialPlayerResearchProgress, createEmptyPlayerCard, type Session } from "../../src/state/session";
import { createDefaultSettings } from "../../src/core/settings";
import { createArchaeologyState } from "../../src/core/strataDig";
import { createEmptyDuelState } from "../../src/core/duelState";
import { DUEL_BATTLE_REWARD, DUEL_DAILY_ATTEMPTS, DUEL_FREE_REFRESHES, DUEL_OPPONENT_COUNT, DUEL_REFRESH_PRICES, duelScoreDelta, duelSeasonEndsAt, duelStreakBonus } from "../../src/core/duelArena";

let clock = new Date("2026-10-06T12:00:00Z");
const NOW = () => clock;

/** 결투장 경계만 보는 세션. 젬은 넉넉히 둔다. */
function makeSession(stamina = 100, clearedIndex = -1, gems = 10_000): Session {
  return {
    ownedRelicSkinIds: new Set(), equippedRelicSkinIds: {},
    discoveredInteractionJournalIds: new Set(), readInteractionJournalIds: new Set(),
    interaction: { slots: [null], claimedRequestIds: [] },
    earnedProfileModifierIds: [], equippedProfileModifierIds: [],
    playerResearch: createInitialPlayerResearchProgress(),
    playerCard: createEmptyPlayerCard(),
    idleExcavation: { assignedRelicIds: [null, null, null], lastSettledAt: null, unclaimed: { gold: 0, cheesecake: 0, rawStone: 0, gems: 0 }, baseStorageSeconds: 14_400, activeProductionMultiplier: 1, storageExtensionExpiresAt: null, retroactiveExcavationGrantVersion: 1 },
    archaeology: createArchaeologyState(),
    settings: createDefaultSettings(),
    completedStoryIds: new Set(), observationRecords: [],
    selectedStageId: null,
    party: ["torika", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["torika", "rex", "dodo"]),
    favorite: "torika",
    bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    staminaUpdatedAt: NOW().toISOString(),
    wallet: { fossil: 0, amber: 0, gems, gold: 0, stamina, dnaFragments: 0, cheesecake: 0, rawStone: 0, raidSigil: 0, salvageRecord: 0, duelEmblem: 0 },
    relicFragments: {}, relicProgress: Object.fromEntries(["torika", "rex", "dodo"].map((id) => [id, { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }])),
    itemInventory: [],
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] },
    productPurchases: {},
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
    expedition: { weekKey: "", dayKey: "", playsToday: 0, bestScore: 0, bestAchievedAt: "", claimedRewardStageIds: [], pendingRankReward: null, allTimeBestScore: 0, lastParty: [], run: null },
    cakeOperation: { clearedIndex },
    relicStory: { metAt: {}, answers: [], claimedChapterIds: [] },
    raid: createEmptyRaidState(),
    bounty: { clearedTierIds: [] },
  };
}


const make = (state: Session) => new FakeServer(state, { latencyMs: 0, now: NOW, random: () => 0.5 });
const TEAM = ["torika", "rex", "dodo"];

describe("FakeServer 결투장", () => {
  it("처음 열면 브론즈 0점에 상대 다섯과 도전권 다섯이 선다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const status = await make(makeSession()).getDuelStatus();
    expect(status).toMatchObject({ score: 0, tierId: "bronze", division: 4, rank: null, attemptsLeft: DUEL_DAILY_ATTEMPTS, blindCount: 0 });
    expect(status.opponents).toHaveLength(DUEL_OPPONENT_COUNT);
    expect(status).toMatchObject({ winStreak: 0, bestStreak: 0, nextStreakBonus: 0, seasonBestTierId: "bronze", lastSeasonTierId: null });
    expect(status.opponents.every(({ units }) => units.every(({ relicId }) => relicId !== null))).toBe(true);
  });

  it("입장이 도전권을 쓰고, 결과가 점수와 휘장을 한 번만 준다", async () => {
    const state = makeSession();
    const server = make(state);
    const status = await server.getDuelStatus();
    const target = status.opponents[1];
    const admission = await server.enterDuel({ opponentId: target.id, relicIds: TEAM, requestId: "d1" });
    expect(admission.units).toHaveLength(3);
    expect((await server.getDuelStatus()).attemptsLeft).toBe(DUEL_DAILY_ATTEMPTS - 1);
    const result = await server.resolveDuel({ requestId: "d1", won: true });
    expect(result.delta).toBe(duelScoreDelta(0, target.score, true));
    expect(result).toMatchObject({ winStreak: 1, streakBonus: 0 });
    expect(result.duelEmblem).toBe(DUEL_BATTLE_REWARD.win);
    expect(state.wallet.duelEmblem).toBe(DUEL_BATTLE_REWARD.win);
    // 재전송은 같은 영수증 — 두 번 주지 않는다.
    await server.resolveDuel({ requestId: "d1", won: true });
    expect(state.wallet.duelEmblem).toBe(DUEL_BATTLE_REWARD.win);
    expect(state.duel?.history[0]).toMatchObject({ won: true, opponentName: target.displayName });
    await expect(server.resolveDuel({ requestId: "nope", won: true })).rejects.toMatchObject({ code: "DUEL_ADMISSION_NOT_FOUND" });
  });

  it("연승은 이긴 판에 보너스를 얹고, 지면 끊긴다", async () => {
    const state = makeSession();
    const server = make(state);
    const play = async (requestId: string, won: boolean) => {
      const { opponents, score } = await server.getDuelStatus();
      const target = opponents.find(({ fought }) => !fought)!;
      await server.enterDuel({ opponentId: target.id, relicIds: TEAM, requestId });
      return { result: await server.resolveDuel({ requestId, won }), base: duelScoreDelta(score, target.score, won), before: score };
    };
    await play("s1", true);
    expect((await server.getDuelStatus()).nextStreakBonus).toBe(duelStreakBonus(2));
    const second = await play("s2", true);
    expect(second.result).toMatchObject({ winStreak: 2, streakBonus: duelStreakBonus(2) });
    expect(second.result.scoreAfter).toBe(second.before + second.base + duelStreakBonus(2));
    await play("s3", false);
    const after = await server.getDuelStatus();
    expect(after).toMatchObject({ winStreak: 0, bestStreak: 2, nextStreakBonus: 0 });
    expect(state.duel?.seasonBestScore).toBe(second.result.scoreAfter);
  });

  it("세워 둔 상대가 아니거나 편성이 틀리면 거절한다", async () => {
    const server = make(makeSession());
    const status = await server.getDuelStatus();
    await expect(server.enterDuel({ opponentId: "duel-npc-99999", relicIds: TEAM, requestId: "x" })).rejects.toMatchObject({ code: "DUEL_OPPONENT_NOT_FOUND" });
    await expect(server.enterDuel({ opponentId: status.opponents[0].id, relicIds: ["torika", "torika", "rex"], requestId: "y" })).rejects.toMatchObject({ code: "DUEL_INVALID_TEAM" });
  });

  it("도전권을 다 쓰면 막히고 젬으로 하나를 더 산다", async () => {
    const state = makeSession();
    const server = make(state);
    for (let index = 0; index < DUEL_DAILY_ATTEMPTS; index += 1) {
      const { opponents } = await server.getDuelStatus();
      await server.enterDuel({ opponentId: opponents.find(({ fought }) => !fought)!.id, relicIds: TEAM, requestId: `a${index}` });
      await server.resolveDuel({ requestId: `a${index}`, won: false });
    }
    const empty = await server.getDuelStatus();
    expect(empty.attemptsLeft).toBe(0);
    await expect(server.enterDuel({ opponentId: empty.opponents[0].id, relicIds: TEAM, requestId: "over" })).rejects.toMatchObject({ code: "DUEL_NO_ATTEMPTS" });
    const gems = state.wallet.gems;
    const bought = await server.buyDuelAttempt();
    expect(bought.attemptsLeft).toBe(1);
    expect(state.wallet.gems).toBe(gems - empty.nextAttemptPrice!);
  });

  it("광고는 도전권 한 장을 더하고, 젬 구매 값을 밀어 올리지 않으며, 하루가 지나면 사라진다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const state = makeSession();
    const server = make(state);
    const before = await server.getDuelStatus();
    const claim = (requestId: string) => server.claimAdReward({ slotId: "duel-attempt", verificationToken: "verified:duel-attempt", requestId });
    await claim("ad1");
    const after = await server.getDuelStatus();
    expect(after.attemptsLeft).toBe(before.attemptsLeft + 1);
    expect(after.nextAttemptPrice).toBe(before.nextAttemptPrice);
    expect(state.wallet.gems).toBe(10_000);
    await claim("ad2"); await claim("ad3");
    await expect(claim("ad4")).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    expect((await server.getDuelStatus()).attemptsLeft).toBe(DUEL_DAILY_ATTEMPTS + 3);
    clock = new Date("2026-10-07T00:00:01Z");
    expect((await server.getDuelStatus()).attemptsLeft).toBe(DUEL_DAILY_ATTEMPTS);
    clock = new Date("2026-10-06T12:00:00Z");
  });

  it("새로고침은 무료 횟수 뒤로 젬이 들고, 할 때마다 값이 오른다", async () => {
    const state = makeSession();
    const server = make(state);
    expect((await server.getDuelStatus()).freeRefreshesLeft).toBe(DUEL_FREE_REFRESHES);
    for (let index = 0; index < DUEL_FREE_REFRESHES; index += 1) await server.refreshDuelOpponents();
    expect(state.wallet.gems).toBe(10_000);
    let spent = 0;
    for (const price of [...DUEL_REFRESH_PRICES, DUEL_REFRESH_PRICES.at(-1)!]) {
      const status = await server.getDuelStatus();
      expect(status).toMatchObject({ freeRefreshesLeft: 0, nextRefreshPrice: price });
      await server.refreshDuelOpponents();
      spent += price;
      expect(state.wallet.gems).toBe(10_000 - spent);
    }
    clock = new Date("2026-10-07T00:00:01Z");
    expect(await server.getDuelStatus()).toMatchObject({ freeRefreshesLeft: DUEL_FREE_REFRESHES, nextRefreshPrice: 0 });
    clock = new Date("2026-10-06T12:00:00Z");
  });

  it("싸운 상대는 남은 후보와 함께 그대로 서고 다시 고를 수 없다", async () => {
    const state = makeSession();
    const server = make(state);
    const before = await server.getDuelStatus();
    const target = before.opponents[1];
    await server.enterDuel({ opponentId: target.id, relicIds: TEAM, requestId: "f1" });
    await server.resolveDuel({ requestId: "f1", won: false });
    const after = await server.getDuelStatus();
    expect(after.opponents.map(({ id }) => id)).toEqual(before.opponents.map(({ id }) => id));
    expect(after.opponents.filter(({ fought }) => fought).map(({ id }) => id)).toEqual([target.id]);
    await expect(server.enterDuel({ opponentId: target.id, relicIds: TEAM, requestId: "f2" })).rejects.toMatchObject({ code: "DUEL_OPPONENT_FOUGHT" });
  });

  it("다섯 모두와 싸우면 새 상대가 선다", async () => {
    const state = makeSession();
    const server = make(state);
    await server.buyDuelAttempt();
    const first = (await server.getDuelStatus()).opponents.map(({ id }) => id);
    for (const [index, id] of first.entries()) {
      await server.enterDuel({ opponentId: id, relicIds: TEAM, requestId: `all${index}` });
      await server.resolveDuel({ requestId: `all${index}`, won: false });
    }
    const next = await server.getDuelStatus();
    expect(next.opponents.every(({ fought }) => !fought)).toBe(true);
    expect(next.opponents.some(({ id }) => first.includes(id))).toBe(false);
  });

  it("티어가 오르면 새 상대가 선다", async () => {
    const state = makeSession();
    state.duel = { ...createEmptyDuelState(), score: 395, seasonBestScore: 395 };
    const server = make(state);
    const before = await server.getDuelStatus();
    const target = before.opponents.at(-1)!;
    await server.enterDuel({ opponentId: target.id, relicIds: TEAM, requestId: "up" });
    const result = await server.resolveDuel({ requestId: "up", won: true });
    expect(result.tierAfter).toBe("silver");
    const after = await server.getDuelStatus();
    expect(after.opponents.every(({ fought }) => !fought)).toBe(true);
    expect(after.opponents.map(({ id }) => id)).not.toEqual(before.opponents.map(({ id }) => id));
  });

  it("방어덱과 가릴 렐릭을 게시한다", async () => {
    const server = make(makeSession());
    const status = await server.setDuelDefense({ relicIds: TEAM, blindChoice: ["dodo", "zz"] });
    expect(status.defense).toEqual(TEAM);
    expect(status.blindChoice).toEqual(["dodo"]);
    expect(status.defenseBlindOrder[0]).toBe("dodo");
    expect(status.defenseBlindOrder).toHaveLength(2);
  });

  it("다음 날이면 도전권이, 다음 시즌이면 점수와 보상 대기가 넘어간다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const state = makeSession();
    const server = make(state);
    const { opponents } = await server.getDuelStatus();
    await server.enterDuel({ opponentId: opponents[2].id, relicIds: TEAM, requestId: "s1" });
    await server.resolveDuel({ requestId: "s1", won: true });
    clock = new Date("2026-10-07T01:00:00Z");
    expect((await server.getDuelStatus()).attemptsLeft).toBe(DUEL_DAILY_ATTEMPTS);
    clock = new Date(duelSeasonEndsAt(clock).getTime() + 60_000);
    const next = await server.getDuelStatus();
    expect(next.pendingSeasonReward).toMatchObject({ tierId: "bronze" });
    expect(next.wins).toBe(0);
    const before = state.wallet.duelEmblem;
    const claimed = await server.claimDuelSeasonReward();
    expect(state.wallet.duelEmblem).toBe(before + claimed.duelEmblem);
    await expect(server.claimDuelSeasonReward()).rejects.toMatchObject({ code: "NOTHING_TO_CLAIM" });
  });

  it("순위표는 100줄이고 한 판을 치른 뒤에야 내가 선다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const server = make(makeSession());
    expect((await server.getDuelRanking()).me).toBeNull();
    const { opponents } = await server.getDuelStatus();
    await server.enterDuel({ opponentId: opponents[0].id, relicIds: TEAM, requestId: "r1" });
    await server.resolveDuel({ requestId: "r1", won: true });
    const ranking = await server.getDuelRanking();
    expect(ranking.entries).toHaveLength(100);
    expect(ranking.me?.isMe).toBe(true);
    expect(ranking.entries.map(({ rank }) => rank)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });
  it("방어덱은 기본 셋으로 서고, 직접 세우면 기본 표시가 꺼진다. 시간이 지나면 방어전이 전적에 남는다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const server = make(makeSession());
    const first = await server.getDuelStatus();
    expect(first.defense).toEqual(["torika", "dodo"]);
    expect(first.defenseIsDefault).toBe(true);
    clock = new Date("2026-10-06T20:30:00Z");
    const later = await server.getDuelStatus();
    expect(later.history.filter(({ side }) => side === "defense")).toHaveLength(2);
    expect(later.score).toBe(later.history.reduce((sum, { delta }) => Math.max(0, sum + delta), 0));
    const set = await server.setDuelDefense({ relicIds: TEAM, blindChoice: [] });
    expect(set.defenseIsDefault).toBe(false);
  });
});
