import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { BREAKTHROUGH_STEPS, RELIC_LEVEL_CAP } from "../../src/core/relicProgression";
import { GameApiError } from "../../src/api/contracts";
import type { Session } from "../../src/state/session";
import { createRuneInstance, enhanceRune as applyRuneEnhancement, type RuneInstance, type RuneStatKey } from "../../src/core/runes";
import { createDefaultSettings } from "../../src/core/settings";

/** API 테스트에서 같은 옵션 구성을 재현하는 보유 룬을 만든다. */
function makeRune(instanceId = "rune-1"): RuneInstance {
  const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
  return createRuneInstance({ instanceId, baseName: "서버 테스트 룬", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
}

/** 각 테스트가 독립적으로 쓸 서버 저장소 역할의 세션을 만든다. */
function makeSession(fossil = 1000): Session {
  return {
    idleExcavation: { assignedRelicIds: [null, null, null], lastSettledAt: null, unclaimed: { fossil: 0, gold: 0, cheesecake: 0 }, baseStorageSeconds: 14_400, activeProductionMultiplier: 1, storageExtensionExpiresAt: null },
    settings: createDefaultSettings(),
    completedStoryIds: new Set(), observationRecords: [],
    selectedStageId: null,
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    wallet: { fossil, amber: 10, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 },
    relicFragments: {}, relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: id === "anky" ? 2 : 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }])),
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] },
    // 상품 테스트가 아닌 세션도 최신 저장 계약의 빈 구매 이력을 명시한다.
    productPurchases: {},
    // 테스트 계정은 광고 수령 이력이 없는 UTC 일일 상태로 시작한다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
  };
}

describe("FakeServer", () => {
  it("발굴 조회는 첫 서버 시각을 초기화하고 편성 변경 전 생산을 원자적으로 정산한다", async () => {
    const state = makeSession(); let now = new Date("2026-08-20T00:00:00Z"); const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    await server.getIdleExcavation();
    await server.saveExcavationFormation({ requestId: "formation-1", assignedRelicIds: ["anky", "rex", "dodo"] });
    now = new Date("2026-08-20T04:00:00Z"); await server.getIdleExcavation();
    expect(state.idleExcavation.unclaimed).toEqual({ fossil: 720, gold: 7200, cheesecake: 72 });
  });

  it("같은 수확 요청을 반복해도 한 번만 지급하고 지갑 상한을 넘기지 않는다", async () => {
    const state = makeSession(); state.wallet.fossil = 9_999_998; state.idleExcavation.unclaimed = { fossil: 5, gold: 2, cheesecake: 1 };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T00:00:00Z") });
    const request = { requestId: "harvest-1" }; const first = await server.harvestExcavation(request); const repeated = await server.harvestExcavation(request);
    expect(repeated).toEqual(first); expect(state.wallet.fossil).toBe(9_999_999); expect(first.discarded.fossil).toBe(4);
  });
  it("강화 요청의 선택 정보만 받아 서버 난수·골드 차감·룬 갱신을 함께 확정한다", async () => {
    const state = makeSession(); state.wallet.gold = 100; state.runeInventory = [makeRune()];
    const statId = state.runeInventory[0].mainStats[0].key;
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0 });
    const response = await server.enhanceRune({ runeInstanceId: "rune-1", statId });
    expect(response).toMatchObject({ succeeded: true, goldSpent: 100, nextSuccessChance: 0.65 });
    expect(state.wallet.gold).toBe(0);
    expect(state.runeInventory[0].enhancementHistory[statId]).toHaveLength(1);
  });

  it("강화는 옵션 잔여 횟수와 골드를 판정 전에 검사해 실패 시 상태를 보존한다", async () => {
    const state = makeSession(); state.wallet.gold = 99; state.runeInventory = [makeRune()];
    const before = JSON.stringify(state.runeInventory);
    const statId = state.runeInventory[0].mainStats[0].key;
    const server = new FakeServer(state, { latencyMs: 0, random: () => { throw new Error("검증 전에 난수를 부르면 안 됩니다."); } });
    await expect(server.enhanceRune({ runeInstanceId: "rune-1", statId })).rejects.toMatchObject({ code: "INSUFFICIENT_GOLD" });
    expect(state.wallet.gold).toBe(99); expect(JSON.stringify(state.runeInventory)).toBe(before);
  });

  it("이름 정책과 전역 장착 중복을 서버 경계에서 구분해 거부한다", async () => {
    const state = makeSession(); state.runeInventory = [makeRune()];
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.renameRune({ runeInstanceId: "rune-1", name: " \u0001 " })).rejects.toMatchObject({ code: "INVALID_RUNE_NAME" });
    const renamed = await server.renameRune({ runeInstanceId: "rune-1", name: "  새 이름  " });
    expect(renamed.rune.customName).toBe("새 이름");
    await server.equipRune({ runeInstanceId: "rune-1", relicId: "anky", slotIndex: 0 });
    // 자리가 맞아도 이미 다른 렐릭이 끼고 있으면 거부한다. 자리 불일치와는 다른 이유다.
    await expect(server.equipRune({ runeInstanceId: "rune-1", relicId: "rex", slotIndex: 0 })).rejects.toMatchObject({ code: "RUNE_ALREADY_EQUIPPED" });
    await expect(server.equipRune({ runeInstanceId: "rune-1", relicId: "rex", slotIndex: 2 })).rejects.toMatchObject({ code: "RUNE_SLOT_MISMATCH" });
    expect(state.relicProgress.anky.heartGemSlots).toEqual(["rune-1", null, null]);
  });

  it("모든 일반 강화 뒤에만 대상 옵션 각인을 정확히 하나 저장한다", async () => {
    const state = makeSession(); let rune = makeRune();
    for (const { key } of rune.mainStats) for (let count = 0; count < 3; count += 1) rune = applyRuneEnhancement(rune, key, 1, 0);
    state.runeInventory = [rune];
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0 });
    const response = await server.engraveRune({ runeInstanceId: "rune-1", statId: rune.mainStats[0].key });
    expect(response.rune.engravings).toEqual([{ statKey: rune.mainStats[0].key, grade: "perfect", valueAdded: 3 }]);
    await expect(server.engraveRune({ runeInstanceId: "rune-1", statId: rune.mainStats[0].key })).rejects.toMatchObject({ code: "RUNE_ENGRAVING_NOT_ALLOWED" });
  });
  it("급여 재화를 검사·차감하고 오른 레벨을 서버 상태에 반영한다", async () => {
    const state = makeSession(); state.wallet.cheesecake = 25;
    const server = new FakeServer(state, { latencyMs: 0 });
    // 열 번 요청해도 치즈케이크가 두 번 치뿐이다. 레벨 2는 80 EXP가 필요해 아직 오르지 않는다.
    const response = await server.feedRelic("anky", 10);
    expect(response).toMatchObject({ relicId: "anky", feeds: 2, cheesecakeSpent: 20, wallet: { cheesecake: 5 } });
    expect(state.relicProgress.anky).toMatchObject({ level: 2, exp: 40 });
    await expect(server.feedRelic("anky")).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
  });

  it("한계 돌파는 그 개체의 파편을 차감하고 별과 상한을 함께 올린다", async () => {
    const state = makeSession();
    const step = BREAKTHROUGH_STEPS[0];
    state.relicProgress.anky = { ...state.relicProgress.anky, level: RELIC_LEVEL_CAP, exp: 0 };
    state.relicFragments.anky = step.fragments; state.wallet.cheesecake = step.cheesecake;
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.feedRelic("anky")).rejects.toMatchObject({ code: "RELIC_MAX_LEVEL" });
    const response = await server.breakThroughRelic("anky");
    expect(response).toMatchObject({ relicId: "anky", breakthrough: 1, levelCap: step.levelCap, stars: 2, fragments: 0 });
    expect(state.relicFragments.anky).toBe(0);
    expect(state.wallet).toMatchObject({ cheesecake: 0 });
    await expect(server.breakThroughRelic("anky")).rejects.toMatchObject({ code: "RELIC_MAX_LEVEL" });
  });

  it("메인 스테이지의 최초와 반복 보상을 데이터대로 구분한다", async () => {
    const state = makeSession(); const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.completeStage("1-1")).resolves.toMatchObject({ firstClear: true, cheesecakeEarned: 30 });
    await expect(server.completeStage("1-1")).resolves.toMatchObject({ firstClear: false, cheesecakeEarned: 10 });
    expect(state.wallet.cheesecake).toBe(40);
  });

  it("승리만 편성 렐릭 유대를 올리고 패배에는 전투 보상을 지급하지 않는다", async () => {
    const state = makeSession(); const server = new FakeServer(state, { latencyMs: 0 });
    await server.completeStage("1-1", false);
    expect([state.wallet.cheesecake, state.relicProgress.anky.bondXp]).toEqual([0, 0]);
    await server.completeStage("1-1", true);
    expect(state.relicProgress.anky.bondXp).toBe(12);
    expect(state.relicProgress.rex.bondXp).toBe(12);
    expect(state.relicProgress.dodo.bondXp).toBe(12);
  });

  it("로비 상호작용은 서버 UTC 날짜마다 첫 터치만 지급한다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T23:59:00Z") });
    await expect(server.interactInLobby("anky")).resolves.toMatchObject({ bondXpEarned: 5 });
    await expect(server.interactInLobby("anky")).resolves.toMatchObject({ bondXpEarned: 0 });
  });

  it("일일 복원은 UTC 하루 3회이고 다음 UTC 날짜에만 횟수를 초기화한다", async () => {
    const state = makeSession(); let now = new Date("2026-08-20T23:59:00Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    for (let index = 0; index < 3; index += 1) await server.enterDailyRestoration();
    await expect(server.enterDailyRestoration()).rejects.toMatchObject({ code: "DAILY_ENTRY_LIMIT" });
    now = new Date("2026-08-21T00:00:00Z");
    await expect(server.enterDailyRestoration()).resolves.toMatchObject({ entriesRemaining: 2, cheesecakeEarned: 40 });
    expect(state.dailyContent).toMatchObject({ date: "2026-08-21", restorationEntries: 1 });
  });
  it("서버 안에서 비용과 결과를 함께 확정한다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0 });

    const response = await server.pullRelics({ bannerId: "fossil", count: 1 });

    expect(response.wallet.fossil).toBe(900);
    expect(response.results).toEqual([{ relicId: "rex", kind: "fragment", fragments: 1, overflowFragments: 0 }]);
    expect(response.duplicateRelicIds).toEqual(["rex"]);
    expect(state.wallet.fossil).toBe(900);
    expect(state.gachaPityByGroup["standard-fossil"].pullsSinceSsr).toBe(0);
  });

  it("최초 획득의 성장 레코드를 같은 처리에서 만들고 같은 10연 중복을 누적한다", async () => {
    const state = makeSession();
    // fossil 배너에서 RNG 0은 rex만 뽑으므로 미보유로 만들어 순차 획득을 검증한다.
    state.owned.delete("rex");
    delete state.relicProgress.rex;
    const response = await new FakeServer(state, { latencyMs: 0, random: () => 0 }).pullRelics({ bannerId: "fossil", count: 10 });
    expect(response.results[0].kind).toBe("new");
    expect(response.results[1]).toMatchObject({ kind: "fragment", fragments: 1 });
    // 중복 아홉 장은 모두 그 개체의 파편이다. 별은 파편을 써서 플레이어가 직접 올린다.
    expect(state.relicProgress.rex).toMatchObject({ level: 1, breakthrough: 0 });
    expect(state.relicFragments.rex).toBe(9);
    expect(state.relicProgress.rex).toMatchObject({ bondLevel: 1, bondXp: 20 });
    expect(state.wallet.dnaFragments).toBe(0);
  });

  it("재화가 부족하면 상태를 변경하지 않는다", async () => {
    const state = makeSession(0);
    const server = new FakeServer(state, { latencyMs: 0 });

    await expect(server.pullRelics({ bannerId: "fossil", count: 1 })).rejects.toMatchObject({
      code: "INSUFFICIENT_CURRENCY",
    } satisfies Partial<GameApiError>);
    expect(state.wallet.fossil).toBe(0);
  });

  it("응답 스냅샷을 바꿔도 서버 상태는 바뀌지 않는다", async () => {
    const state = makeSession();
    state.runeInventory = [makeRune()]; state.relicProgress.anky.heartGemSlots[0] = "rune-1";
    const server = new FakeServer(state, { latencyMs: 0 });
    const snapshot = await server.getPlayerState();

    snapshot.wallet.fossil = 0;
    snapshot.ownedRelicIds.push("spino");
    snapshot.relicProgress.anky.heartGemSlots[0] = null;
    snapshot.runeInventory.runes.length = 0;

    expect(state.wallet.fossil).toBe(1000);
    expect(state.owned.has("spino")).toBe(false);
    expect(state.relicProgress.anky.heartGemSlots[0]).toBe("rune-1");
    expect(state.runeInventory).toHaveLength(1);
  });

  it("완료 전 수령을 거부하고 완료 보상은 중복 지급하지 않는다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T12:00:00Z") });
    await expect(server.claimMissionRewards(["daily-battle"])).rejects.toMatchObject({ code: "MISSION_NOT_COMPLETE" });
    await server.completeStage("1-1", true);
    await expect(server.claimMissionRewards(["daily-battle"])).resolves.toMatchObject({ claimedIds: ["daily-battle"], cheesecakeEarned: 20 });
    const afterFirstClaim = state.wallet.cheesecake;
    await expect(server.claimMissionRewards(["daily-battle"])).rejects.toMatchObject({ code: "MISSION_ALREADY_CLAIMED" });
    expect(state.wallet.cheesecake).toBe(afterFirstClaim);
  });

  it("발굴·급여·로비 성공을 각 API 경계에서 임무에 한 번 반영한다", async () => {
    const state = makeSession(); state.wallet.cheesecake = 20;
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0, now: () => new Date("2026-08-20T12:00:00Z") });
    await server.pullRelics({ bannerId: "fossil", count: 1 });
    await server.feedRelic("anky", 1);
    await server.interactInLobby("anky");
    expect(state.missions.progress).toMatchObject({ "daily-excavate": 1, "daily-salary": 1, "daily-lobby": 1 });
    await expect(server.getMissions()).resolves.toMatchObject({ claimableCount: 3 });
  });
});

describe("FakeServer 상품 카탈로그", () => {
  it("인게임 가격 차감, 지급, 일일 제한을 한 처리로 확정한다", async () => {
    const state = makeSession(1000);
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await expect(server.purchaseProduct("trade-weeds")).resolves.toMatchObject({ productId: "trade-weeds", remaining: 2, wallet: { fossil: 820, cheesecake: 100 } });
    expect(state.productPurchases["trade-weeds"]).toEqual({ periodKey: "2026-08-22", count: 1 });
    await server.purchaseProduct("trade-weeds");
    await server.purchaseProduct("trade-weeds");
    await expect(server.purchaseProduct("trade-weeds")).rejects.toMatchObject({ code: "PURCHASE_LIMIT_REACHED" });
  });

  it("재화 부족과 유료 상품은 어떤 지급도 만들지 않는다", async () => {
    const state = makeSession(0); const before = { ...state.wallet };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await expect(server.purchaseProduct("trade-weeds")).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
    await expect(server.purchaseProduct("premium-starter")).rejects.toMatchObject({ code: "PLATFORM_PAYMENT_REQUIRED" });
    expect(state.wallet).toEqual(before);
    expect(state.productPurchases).toEqual({});
  });

  it("후원 영수증 검증과 권리 활성화를 요청 재시도에도 한 결과로 유지한다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    const receipt = { productId: "premium-monthly", platform: "test" as const, receipt: "verified-receipt:premium-monthly:tx-1", requestId: "verify-1" };
    const first = await server.verifyPurchaseReceipt(receipt);
    await expect(server.verifyPurchaseReceipt(receipt)).resolves.toEqual(first);
    const activation = await server.activatePass({ verificationId: first.verificationId, requestId: "activate-1" });
    await expect(server.activatePass({ verificationId: first.verificationId, requestId: "activate-1" })).resolves.toEqual(activation);
    expect(activation.entitlement).toMatchObject({ productId: "premium-monthly", activatedAt: "2026-08-22T12:00:00.000Z", expiresAt: "2026-09-21T12:00:00.000Z", active: true });
  });

  it("패스 즉시 수령도 광고 슬롯의 기본 보상·UTC 한도를 공유하고 중복 지급하지 않는다", async () => {
    const state = makeSession(); let now = new Date("2026-08-22T23:59:00Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    const verified = await server.verifyPurchaseReceipt({ productId: "premium-monthly", platform: "test", receipt: "verified-receipt:premium-monthly:tx-2", requestId: "verify-2" });
    const { entitlement } = await server.activatePass({ verificationId: verified.verificationId, requestId: "activate-2" });
    const request = { entitlementId: entitlement.entitlementId, slotId: "daily-stamina", requestId: "instant-1" };
    const first = await server.claimInstantAdReward(request);
    await expect(server.claimInstantAdReward(request)).resolves.toMatchObject({ dailyClaims: 1, wallet: first.wallet });
    expect(first).toMatchObject({ reward: { currency: "stamina", amount: 10 }, dailyBonus: { currency: "gems", amount: 5 }, dailyRemaining: 2 });
    await server.claimInstantAdReward({ ...request, requestId: "instant-2" });
    await server.claimInstantAdReward({ ...request, requestId: "instant-3" });
    await expect(server.claimInstantAdReward({ ...request, requestId: "instant-4" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    now = new Date("2026-08-23T00:00:00Z");
    await expect(server.claimInstantAdReward({ ...request, requestId: "instant-next-day" })).resolves.toMatchObject({ dailyClaims: 1, dailyBonus: { currency: "gems", amount: 5 } });
  });
});

describe("FakeServer DNA 조각 교환소와 경제 경계", () => {
  it("선택한 보유 렐릭의 파편만 늘리고 DNA를 차감한다", async () => {
    const state = makeSession(); state.wallet.dnaFragments = 10;
    const response = await new FakeServer(state, { latencyMs: 0 }).exchangeDna({ offerId: "dna-fragment", relicId: "rex" });
    expect(response).toMatchObject({ offerId: "dna-fragment", rewardKind: "relic_fragment", wallet: { dnaFragments: 0 } });
    expect(state.relicFragments.rex).toBe(1);
    expect(state.relicFragments.anky ?? 0).toBe(0);
  });

  it("잘못된 대상은 거부하고 같은 정의의 룬도 서로 다른 인스턴스로 지급한다", async () => {
    const state = makeSession(); state.wallet.dnaFragments = 30;
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.exchangeDna({ offerId: "dna-fragment", relicId: "not-owned" })).rejects.toMatchObject({ code: "INVALID_EXCHANGE_TARGET" });
    const first = await server.exchangeDna({ offerId: "dna-rune" });
    expect(first.runeInventory.runes).toHaveLength(1);
    expect(first.grantedRune).toEqual(first.runeInventory.runes[0]);
    expect(state.wallet.dnaFragments).toBe(15);
    const second = await server.exchangeDna({ offerId: "dna-rune" });
    // 시계와 RNG가 같아도 획득 건별 인스턴스와 중첩 배열은 독립적이어야 한다.
    expect(second.grantedRune?.instanceId).not.toBe(first.grantedRune?.instanceId);
    expect(new Set(state.runeInventory.map(({ instanceId }) => instanceId)).size).toBe(2);
    expect(second.grantedRune).not.toBe(state.runeInventory[0]);
  });

  it("이미 저장된 시각·순번 ID와 충돌하면 미사용 ID까지 전진한다", async () => {
    const state = makeSession(); state.wallet.dnaFragments = 15;
    const now = () => new Date("2026-08-22T12:00:00Z");
    state.runeInventory = [makeRune(`rune-${now().getTime()}-0`)];
    const response = await new FakeServer(state, { latencyMs: 0, now, random: () => 0 }).exchangeDna({ offerId: "dna-rune" });
    expect(response.grantedRune?.instanceId).toBe(`rune-${now().getTime()}-1`);
    expect(state.runeInventory).toHaveLength(2);
  });

  it("지급 결과가 재화 상한을 넘으면 원본 상태를 변경하지 않는다", async () => {
    const state = makeSession(); state.wallet.dnaFragments = 5; state.wallet.fossil = 9_999_900;
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.exchangeDna({ offerId: "dna-past-event" })).rejects.toMatchObject({ code: "CURRENCY_LIMIT_EXCEEDED" });
    expect(state.wallet).toMatchObject({ dnaFragments: 5, fossil: 9_999_900 });
  });
});

describe("FakeServer 광고 보상 경계", () => {
  it("완료 토큰을 검증하고 일반 재화와 UTC 일일 상태를 함께 확정한다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T23:59:00Z") });
    const result = await server.claimAdReward({ slotId: "daily-stamina", verificationToken: "verified:daily-stamina", requestId: "ad-request-1" });
    expect(result).toMatchObject({ reward: { currency: "stamina", amount: 10 }, dailyClaims: 1, dailyRemaining: 2 });
    expect(state.dailyAdRewards).toEqual({ date: "2026-08-22", claimsBySlot: { "daily-stamina": 1 }, requestIds: ["ad-request-1"] });
  });

  it("잘못된 토큰·중복 ID·일일 초과는 지급 없이 거부하고 다음 UTC 일자에 초기화한다", async () => {
    const state = makeSession(); let now = new Date("2026-08-22T12:00:00Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    await expect(server.claimAdReward({ slotId: "daily-cheesecake", verificationToken: "invalid", requestId: "bad" })).rejects.toMatchObject({ code: "AD_TOKEN_INVALID" });
    for (let index = 0; index < 3; index += 1) await server.claimAdReward({ slotId: "daily-cheesecake", verificationToken: "verified:daily-cheesecake", requestId: `claim-${index}` });
    const before = state.wallet.cheesecake;
    await expect(server.claimAdReward({ slotId: "daily-cheesecake", verificationToken: "verified:daily-cheesecake", requestId: "claim-0" })).rejects.toMatchObject({ code: "AD_REQUEST_DUPLICATE" });
    await expect(server.claimAdReward({ slotId: "daily-cheesecake", verificationToken: "verified:daily-cheesecake", requestId: "over-limit" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    expect(state.wallet.cheesecake).toBe(before);
    now = new Date("2026-08-23T00:00:00Z");
    await expect(server.claimAdReward({ slotId: "daily-cheesecake", verificationToken: "verified:daily-cheesecake", requestId: "next-day" })).resolves.toMatchObject({ dailyClaims: 1 });
  });
});
