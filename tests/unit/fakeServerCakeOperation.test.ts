import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createEmptyRaidState, createInitialPlayerResearchProgress, type Session } from "../../src/state/session";
import { createDefaultSettings } from "../../src/core/settings";
import { createArchaeologyState } from "../../src/core/strataDig";
import { CAKE_OPERATION_TIERS, getCakeOperationTier } from "../../src/data/cakeOperation";

const NOW = () => new Date("2026-09-19T12:00:00Z");

/** 대작전 경계만 보는 세션. 스테미나는 넉넉히 채워 배율 계산이 잔액에 막히지 않게 한다. */
function makeSession(stamina = 100, clearedIndex = -1): Session {
  return {
    ownedRelicSkinIds: new Set(), equippedRelicSkinIds: {},
    discoveredInteractionJournalIds: new Set(), readInteractionJournalIds: new Set(),
    interaction: { slots: [null], claimedRequestIds: [] },
    earnedProfileModifierIds: [], equippedProfileModifierIds: [],
    playerResearch: createInitialPlayerResearchProgress(),
    idleExcavation: { assignedRelicIds: [null, null, null], lastSettledAt: null, unclaimed: { gold: 0, cheesecake: 0, fossil: 0, gems: 0 }, baseStorageSeconds: 14_400, activeProductionMultiplier: 1, storageExtensionExpiresAt: null, retroactiveExcavationGrantVersion: 1 },
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
    wallet: { fossil: 0, amber: 0, gems: 0, gold: 0, stamina, dnaFragments: 0, cheesecake: 0, rawStone: 0 },
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
  };
}

const make = (state: Session) => new FakeServer(state, { latencyMs: 0, now: NOW });

/** 광고 제거 멤버십을 실제 구매 경로로 켠다 — 서버가 권리 목록을 보고 배율을 연다. */
async function buyAdFreeMembership(server: FakeServer, suffix: string): Promise<void> {
  const verified = await server.verifyPurchaseReceipt({ productId: "premium-adfree", platform: "test", receipt: `verified-receipt:premium-adfree:${suffix}`, requestId: `verify-${suffix}` });
  await server.activatePass({ verificationId: verified.verificationId, requestId: `activate-${suffix}` });
}

const TIER = CAKE_OPERATION_TIERS[0];

describe("FakeServer 치즈케이크 대작전", () => {
  it("입장은 배율만큼의 스테미나만 빼고 보상은 얹지 않는다", async () => {
    const state = makeSession(); const server = make(state);
    const enter = await server.enterCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "enter-1" });
    expect(enter.staminaSpent).toBe(TIER.staminaCost * 2);
    expect(state.wallet.stamina).toBe(100 - TIER.staminaCost * 2);
    expect(state.wallet.cheesecake).toBe(0);
    // 같은 요청 ID는 두 번 빼지 않는다.
    await expect(server.enterCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "enter-1" })).resolves.toEqual(enter);
    expect(state.wallet.stamina).toBe(100 - TIER.staminaCost * 2);
  });

  it("승리 확정은 배율만큼 지급하고 다음 단계를 열며, 같은 요청은 한 번만 준다", async () => {
    const state = makeSession(); const server = make(state);
    await server.enterCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "enter-2" });
    const done = await server.completeCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "enter-2", victory: true });
    expect(done.granted.cheesecake).toBe(TIER.rewardCheesecake * 2);
    expect(done.unlockedNextTier).toBe(true);
    expect(state.cakeOperation.clearedIndex).toBe(0);
    await expect(server.completeCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "enter-2", victory: true })).resolves.toEqual(done);
    expect(state.wallet.cheesecake).toBe(TIER.rewardCheesecake * 2);
  });

  /** 요청이 배율을 부풀려도 실제로 치른 값(입장 영수증)만 지급 근거가 된다. */
  it("확정 요청의 배율이 입장 영수증과 달라도 영수증의 배율로만 지급한다", async () => {
    const state = makeSession(); const server = make(state);
    await server.enterCakeOperation({ tierId: TIER.id, multiplier: 1, requestId: "enter-3" });
    const done = await server.completeCakeOperation({ tierId: TIER.id, multiplier: 3, requestId: "enter-3", victory: true });
    expect(done.multiplier).toBe(1);
    expect(done.granted.cheesecake).toBe(TIER.rewardCheesecake);
  });

  it("패배는 보상도 해금도 남기지 않는다", async () => {
    const state = makeSession(); const server = make(state);
    await server.enterCakeOperation({ tierId: TIER.id, multiplier: 1, requestId: "enter-4" });
    const done = await server.completeCakeOperation({ tierId: TIER.id, multiplier: 1, requestId: "enter-4", victory: false });
    expect(done.granted).toEqual({});
    expect(done.unlockedNextTier).toBe(false);
    expect(state.cakeOperation.clearedIndex).toBe(-1);
  });

  it("열리지 않은 단계는 입장 자체를 거절한다", async () => {
    const server = make(makeSession());
    await expect(server.enterCakeOperation({ tierId: CAKE_OPERATION_TIERS[2].id, multiplier: 1, requestId: "enter-5" })).rejects.toMatchObject({ code: "CAKE_TIER_LOCKED" });
    await expect(server.enterCakeOperation({ tierId: "없는-단계", multiplier: 1, requestId: "enter-6" })).rejects.toMatchObject({ code: "CAKE_TIER_NOT_FOUND" });
  });

  it("x3는 광고 제거 멤버십이 있어야 열린다", async () => {
    const state = makeSession(); const server = make(state);
    await expect(server.enterCakeOperation({ tierId: TIER.id, multiplier: 3, requestId: "enter-7" })).rejects.toMatchObject({ code: "CAKE_MULTIPLIER_LOCKED" });
    await buyAdFreeMembership(server, "cake");
    const enter = await server.enterCakeOperation({ tierId: TIER.id, multiplier: 3, requestId: "enter-8" });
    expect(enter.multiplier).toBe(3);
    expect(enter.adFreeMembership).toBe(true);
  });

  /** 표에 없는 배율을 그대로 곱하면 한 번의 요청이 지갑을 상한까지 턴다. */
  it("표에 없는 배율은 x1로 좁힌다", async () => {
    const state = makeSession(); const server = make(state);
    const enter = await server.enterCakeOperation({ tierId: TIER.id, multiplier: 99, requestId: "enter-9" });
    expect(enter.multiplier).toBe(1);
    expect(state.wallet.stamina).toBe(100 - TIER.staminaCost);
  });

  it("스테미나가 모자라면 입장도 소탕도 막힌다", async () => {
    const server = make(makeSession(TIER.staminaCost - 1, 0));
    await expect(server.enterCakeOperation({ tierId: TIER.id, multiplier: 1, requestId: "enter-10" })).rejects.toMatchObject({ code: "INSUFFICIENT_STAMINA" });
    await expect(server.sweepCakeOperation({ tierId: TIER.id, multiplier: 1, requestId: "sweep-1" })).rejects.toMatchObject({ code: "INSUFFICIENT_STAMINA" });
  });

  it("소탕은 이겨 본 단계만 통과하고 차감과 지급이 한 처리로 끝난다", async () => {
    const state = makeSession(100, -1); const server = make(state);
    // 아직 한 번도 이기지 않았으므로 해금된 첫 단계라도 소탕은 막힌다.
    await expect(server.sweepCakeOperation({ tierId: TIER.id, multiplier: 1, requestId: "sweep-2" })).rejects.toMatchObject({ code: "CAKE_TIER_LOCKED" });
    state.cakeOperation = { clearedIndex: 0 };
    const swept = await server.sweepCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "sweep-3" });
    expect(swept.staminaSpent).toBe(TIER.staminaCost * 2);
    expect(swept.granted.cheesecake).toBe(TIER.rewardCheesecake * 2);
    expect(state.wallet.stamina).toBe(100 - TIER.staminaCost * 2);
    expect(state.wallet.cheesecake).toBe(TIER.rewardCheesecake * 2);
    // 같은 요청 ID로 다시 불러도 한 번만 오간다.
    await expect(server.sweepCakeOperation({ tierId: TIER.id, multiplier: 2, requestId: "sweep-3" })).resolves.toEqual(swept);
    expect(state.wallet.cheesecake).toBe(TIER.rewardCheesecake * 2);
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
