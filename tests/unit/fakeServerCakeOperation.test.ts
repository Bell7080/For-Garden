import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createEmptyRaidState, createInitialPlayerResearchProgress, createEmptyPlayerCard, type Session } from "../../src/state/session";
import { createDefaultSettings } from "../../src/core/settings";
import { createArchaeologyState } from "../../src/core/strataDig";
import { CAKE_OPERATION_TIERS, cakeOperationRunCost, getCakeOperationTier } from "../../src/data/cakeOperation";
import { SWEEP_TICKET_ITEM } from "../../src/core/dungeonShortcut";

const NOW = () => new Date("2026-09-19T12:00:00Z");

/** 대작전 경계만 보는 세션. 스테미나는 넉넉히 채워 소탕 계산이 잔액에 막히지 않게 한다. */
function makeSession(stamina = 100, clearedIndex = -1): Session {
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
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    staminaUpdatedAt: NOW().toISOString(),
    wallet: { fossil: 0, amber: 0, gems: 0, gold: 0, stamina, dnaFragments: 0, cheesecake: 0, rawStone: 0, raidSigil: 0, salvageRecord: 0 },
    relicFragments: {}, relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }])),
    itemInventory: [],
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] },
    productPurchases: {},
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
    expedition: { weekKey: "", playsThisWeek: 0, bestScore: 0, allTimeBestScore: 0, lastParty: [], run: null },
    cakeOperation: { clearedIndex },
    raid: createEmptyRaidState(),
    bounty: { clearedTierIds: [] },
  };
}

const make = (state: Session) => new FakeServer(state, { latencyMs: 0, now: NOW });

/** 광고 제거 멤버십을 실제 구매 경로로 켠다 — 서버가 권리 목록을 보고 소탕권을 건너뛴다. */
async function buyAdFreeMembership(server: FakeServer, suffix: string): Promise<void> {
  const verified = await server.verifyPurchaseReceipt({ productId: "premium-adfree", platform: "test", receipt: `verified-receipt:premium-adfree:${suffix}`, requestId: `verify-${suffix}` });
  await server.activatePass({ verificationId: verified.verificationId, requestId: `activate-${suffix}` });
}

const TIER = CAKE_OPERATION_TIERS[0];
const COST = cakeOperationRunCost(TIER).staminaCost;

describe("FakeServer 치즈케이크 대작전", () => {
  it("입장은 한 판의 스테미나만 빼고 보상은 얹지 않는다", async () => {
    const state = makeSession(); const server = make(state);
    const enter = await server.enterCakeOperation({ tierId: TIER.id, requestId: "enter-1" });
    expect(enter.staminaSpent).toBe(COST);
    expect(state.wallet.stamina).toBe(100 - COST);
    expect(state.wallet.cheesecake).toBe(0);
    // 같은 요청 ID는 두 번 빼지 않는다.
    await expect(server.enterCakeOperation({ tierId: TIER.id, requestId: "enter-1" })).resolves.toEqual(enter);
    expect(state.wallet.stamina).toBe(100 - COST);
  });

  it("승리 확정은 한 판의 보상을 주고 다음 단계를 열며, 같은 요청은 한 번만 준다", async () => {
    const state = makeSession(); const server = make(state);
    await server.enterCakeOperation({ tierId: TIER.id, requestId: "enter-2" });
    const done = await server.completeCakeOperation({ tierId: TIER.id, requestId: "enter-2", victory: true });
    expect(done.granted.cheesecake).toBe(TIER.rewardCheesecake);
    expect(done.unlockedNextTier).toBe(true);
    expect(state.cakeOperation.clearedIndex).toBe(0);
    await expect(server.completeCakeOperation({ tierId: TIER.id, requestId: "enter-2", victory: true })).resolves.toEqual(done);
    expect(state.wallet.cheesecake).toBe(TIER.rewardCheesecake);
  });

  it("패배는 보상도 해금도 남기지 않는다", async () => {
    const state = makeSession(); const server = make(state);
    await server.enterCakeOperation({ tierId: TIER.id, requestId: "enter-4" });
    const done = await server.completeCakeOperation({ tierId: TIER.id, requestId: "enter-4", victory: false });
    expect(done.granted).toEqual({});
    expect(done.unlockedNextTier).toBe(false);
    expect(state.cakeOperation.clearedIndex).toBe(-1);
  });

  it("열리지 않은 단계는 입장 자체를 거절한다", async () => {
    const server = make(makeSession());
    await expect(server.enterCakeOperation({ tierId: CAKE_OPERATION_TIERS[2].id, requestId: "enter-5" })).rejects.toMatchObject({ code: "CAKE_TIER_LOCKED" });
    await expect(server.enterCakeOperation({ tierId: "없는-단계", requestId: "enter-6" })).rejects.toMatchObject({ code: "CAKE_TIER_NOT_FOUND" });
  });

  it("스테미나가 모자라면 입장도 소탕도 막힌다", async () => {
    const state = makeSession(COST - 1, 0); state.itemInventory = [{ itemId: SWEEP_TICKET_ITEM, quantity: 5 }];
    const server = make(state);
    await expect(server.enterCakeOperation({ tierId: TIER.id, requestId: "enter-10" })).rejects.toMatchObject({ code: "INSUFFICIENT_STAMINA" });
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 1, requestId: "sweep-1" })).rejects.toMatchObject({ code: "INSUFFICIENT_STAMINA" });
  });

  it("소탕은 이겨 본 단계만 통과하고 횟수만큼 차감·지급하며 소탕권을 한 장씩 쓴다", async () => {
    const state = makeSession(100, -1); state.itemInventory = [{ itemId: SWEEP_TICKET_ITEM, quantity: 5 }];
    const server = make(state);
    // 아직 한 번도 이기지 않았으므로 해금된 첫 단계라도 소탕은 막힌다.
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 1, requestId: "sweep-2" })).rejects.toMatchObject({ code: "DUNGEON_NOT_CLEARED" });
    state.cakeOperation = { clearedIndex: 0 };
    const swept = await server.sweepCakeOperation({ tierId: TIER.id, count: 3, requestId: "sweep-3" });
    expect(swept).toMatchObject({ count: 3, staminaSpent: COST * 3, ticketsSpent: 3 });
    expect(swept.granted.cheesecake).toBe(TIER.rewardCheesecake * 3);
    expect(state.wallet.stamina).toBe(100 - COST * 3);
    expect(state.itemInventory).toEqual([{ itemId: SWEEP_TICKET_ITEM, quantity: 2 }]);
    // 같은 요청 ID로 다시 불러도 한 번만 오간다.
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 3, requestId: "sweep-3" })).resolves.toEqual(swept);
    expect(state.wallet.cheesecake).toBe(TIER.rewardCheesecake * 3);
    // 남은 두 장으로 세 번은 안 된다.
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 3, requestId: "sweep-4" })).rejects.toMatchObject({ code: "SWEEP_TICKET_SHORTAGE" });
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 0, requestId: "sweep-5" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("멤버십이면 소탕권 없이 소탕한다", async () => {
    const state = makeSession(100, 0); const server = make(state);
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 1, requestId: "sweep-6" })).rejects.toMatchObject({ code: "SWEEP_TICKET_SHORTAGE" });
    await buyAdFreeMembership(server, "cake");
    await expect(server.sweepCakeOperation({ tierId: TIER.id, count: 2, requestId: "sweep-7" })).resolves.toMatchObject({ ticketsSpent: 0, count: 2 });
  });

  it("광고를 보면 소탕권 다섯 장이 가방에 들어온다", async () => {
    const state = makeSession(); const server = make(state);
    const claimed = await server.claimAdReward({ slotId: "sweep-tickets", verificationToken: "verified:sweep-tickets", requestId: "ad-1" });
    expect(claimed.dailyAdRewards.claimsBySlot["sweep-tickets"]).toBe(1);
    expect(state.itemInventory).toEqual([{ itemId: SWEEP_TICKET_ITEM, quantity: 5 }]);
  });

  it("공개 스냅샷이 해금 단계와 멤버십 여부를 함께 싣는다", async () => {
    const server = make(makeSession(100, 3));
    const before = await server.getPlayerState();
    expect(before.cakeOperation).toEqual({ clearedIndex: 3 });
    expect(before.adFreeMembership).toBe(false);
    await buyAdFreeMembership(server, "snapshot");
    await expect(server.getPlayerState()).resolves.toMatchObject({ adFreeMembership: true });
  });

  it("단계 정의는 서버가 읽는 값과 같은 표에서 나온다", () => {
    expect(getCakeOperationTier(TIER.id)).toBe(TIER);
  });
});
