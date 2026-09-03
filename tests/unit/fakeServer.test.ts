import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { BREAKTHROUGH_STEPS, RELIC_LEVEL_CAP } from "../../src/core/relicProgression";
import { GameApiError } from "../../src/api/contracts";
import { createInitialPlayerResearchProgress, type Session } from "../../src/state/session";
import { createRuneInstance, enhanceRune as applyRuneEnhancement, runeEnhancementIncrease, type RuneInstance, type RuneStatKey } from "../../src/core/runes";
import { createDefaultSettings } from "../../src/core/settings";
import { WALLET_CAPS } from "../../src/data/economy";
import { staminaCurrencyRecharge } from "../../src/data/staminaRecharge";
import { staminaMaxForPlayer } from "../../src/core/stamina";

/** API 테스트에서 같은 옵션 구성을 재현하는 보유 룬을 만든다. */
function makeRune(instanceId = "rune-1"): RuneInstance {
  const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
  return createRuneInstance({ instanceId, baseName: "서버 테스트 룬", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
}

/** 각 테스트가 독립적으로 쓸 서버 저장소 역할의 세션을 만든다. */
function makeSession(fossil = 1000): Session {
  return {
    // 수식어 manager 테스트가 아닌 세션은 빈 ID 목록을 명시한다.
    earnedProfileModifierIds: [], equippedProfileModifierIds: [],
    playerResearch: createInitialPlayerResearchProgress(),
    idleExcavation: { assignedRelicIds: [null, null, null], lastSettledAt: null, unclaimed: { gold: 0, cheesecake: 0, fossil: 0, gems: 0 }, baseStorageSeconds: 14_400, activeProductionMultiplier: 1, storageExtensionExpiresAt: null, retroactiveExcavationGrantVersion: 1 },
    settings: createDefaultSettings(),
    completedStoryIds: new Set(), observationRecords: [],
    selectedStageId: null,
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    staminaUpdatedAt: "",
    wallet: { fossil, amber: 10, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 },
    relicFragments: {}, relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: id === "anky" ? 2 : 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }])),
    itemInventory: [],
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] },
    // 상품 테스트가 아닌 세션도 최신 저장 계약의 빈 구매 이력을 명시한다.
    productPurchases: {},
    // 테스트 계정은 광고 수령 이력이 없는 UTC 일일 상태로 시작한다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
    // API 테스트의 원정 저장 계약은 빈 상태로 명시한다.
    expedition: { weekKey: "", playsThisWeek: 0, bestScore: 0, allTimeBestScore: 0, lastParty: [], run: null },
  };
}

describe("FakeServer", () => {
  /** 실제 피해량 없이 각 렐릭의 공용 공속 쿨다운을 만족하는 기본 공격 입력이다. */
  const bossActions = (seconds: number) => Array.from({ length: Math.ceil(seconds / 2) }, (_, index) => ["anky", "rex", "dodo"].map((actorId) => (
    { elapsedMs: index * 2_000, actorId, kind: "basic" as const }
  ))).flat();

  it("보스 점수는 최고 기록만 갱신하고 더 낮은 제출은 최고 기록을 내리지 않는다", async () => {
    const server = new FakeServer(makeSession(), { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
    const high = await server.submitExpeditionBossScore({ requestId: "boss-high", actions: bossActions(10) });
    const low = await server.submitExpeditionBossScore({ requestId: "boss-low", actions: [] });
    expect(high.improved).toBe(true); expect(low.improved).toBe(false); expect(low.bestScore).toBe(high.score); expect(low.score).toBe(0);
  });

  it("누적 단계 보상은 다른 요청 ID로 재요청해도 한 번만 지급한다", async () => {
    const state = makeSession(); const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
    // 실제 스킬 계수 점수를 여러 정상 런으로 누적해 첫 주간 단계에 도달시킨다.
    let weekly = await server.getExpeditionWeeklyBest();
    for (let run = 0; weekly.cumulativeScore < 10_000; run += 1) {
      await server.submitExpeditionBossScore({ requestId: `boss-reward-score-${run}`, actions: bossActions(10) });
      weekly = await server.getExpeditionWeeklyBest();
    }
    const first = await server.claimExpeditionReward({ requestId: "reward-a", stageId: "damage-10k" }); const gold = state.wallet.gold;
    const repeated = await server.claimExpeditionReward({ requestId: "reward-b", stageId: "damage-10k" });
    weekly = await server.getExpeditionWeeklyBest();
    // 공개 DTO가 운영 단계와 수령 스냅샷을 함께 반환해 클라이언트 정적 표를 UI 권한으로 쓰지 않게 한다.
    expect(first.alreadyClaimed).toBe(false); expect(first.wallet.gold).toBe(gold); expect(repeated.alreadyClaimed).toBe(true);
    expect(weekly.rewardStages.find(({ id }) => id === "damage-10k")?.claimed).toBe(true); expect(state.wallet.gold).toBe(gold);
  });

  it("피해 숫자를 제출할 필드가 없고 비정상 입력은 API 경계에서 거부한다", async () => {
    const server = new FakeServer(makeSession(), { latencyMs: 0 });
    await expect(server.submitExpeditionBossScore({ requestId: "forged", actions: [{ elapsedMs: 0, actorId: "hacker", kind: "ultimate" }] })).rejects.toMatchObject({ code: "EXPEDITION_SCORE_REJECTED" });
  });
  it("발굴 조회는 첫 서버 시각을 초기화하고 편성 변경 전 생산을 원자적으로 정산한다", async () => {
    const state = makeSession(); let now = new Date("2026-08-20T00:00:00Z"); const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    await server.getIdleExcavation();
    await server.saveExcavationFormation({ requestId: "formation-1", assignedRelicIds: ["anky", "rex", "dodo"] });
    now = new Date("2026-08-20T04:00:00Z"); await server.getIdleExcavation();
    expect(state.idleExcavation.unclaimed).toEqual({ gold: 107.1, cheesecake: 0, fossil: 1.32, gems: 1.12 });
  });

  it("v18 신규 재화 소급분은 서버 기준 시각과 보관 상한으로 한 번만 정산한다", async () => {
    const state = makeSession();
    state.idleExcavation.assignedRelicIds = ["rex", "dodo", "anky"];
    state.idleExcavation.lastSettledAt = "2026-08-19T00:00:00.000Z";
    state.idleExcavation.retroactiveExcavationGrantVersion = 0;
    const now = new Date("2026-08-20T00:00:00.000Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    const first = await server.getIdleExcavation();
    const repeated = await server.getIdleExcavation();
    // 24시간 미접속이어도 4시간만 계산하며, 같은 서버 시각의 재조회는 다시 지급하지 않는다.
    expect(first.excavation.unclaimed).toEqual(repeated.excavation.unclaimed);
    expect(first.excavation.unclaimed).toMatchObject({ fossil: 1.32, gems: 1.12 });
    expect(first.excavation.retroactiveExcavationGrantVersion).toBe(1);
  });

  it("미보유·중복 렐릭 편성 저장 실패는 서버 확정 편성을 유지한다", async () => {
    const state = makeSession(); state.idleExcavation.assignedRelicIds = ["anky", null, null];
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.saveExcavationFormation({ requestId: "unowned", assignedRelicIds: ["spino", null, null] })).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(server.saveExcavationFormation({ requestId: "duplicate", assignedRelicIds: ["rex", "rex", null] })).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(state.idleExcavation.assignedRelicIds).toEqual(["anky", null, null]);
  });

  it("같은 수확 요청을 반복해도 한 번만 지급하고 지갑 상한을 넘기지 않는다", async () => {
    const state = makeSession(); state.wallet.gold = 999_999_998; state.idleExcavation.unclaimed = { gold: 5, cheesecake: 1, fossil: 0, gems: 0 };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T00:00:00Z") });
    const request = { requestId: "harvest-1" }; const first = await server.harvestExcavation(request); const repeated = await server.harvestExcavation(request);
    expect(repeated).toEqual(first); expect(state.wallet.gold).toBe(999_999_999); expect(first.discarded.gold).toBe(4);
    expect(first.remaining).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0 });
  });

  it.each([[53.4429, 0.499, false], [53.55, 0.5, true], [107.1, 1, true]] as const)("발굴 저장 비율 %s를 서버 응답의 %s와 알림 %s로 확정한다", async (gold, ratio, notice) => {
    const state = makeSession(); const now = new Date("2026-08-20T00:00:00Z");
    state.idleExcavation.assignedRelicIds = ["anky", null, null]; state.idleExcavation.lastSettledAt = now.toISOString();
    state.idleExcavation.unclaimed = { gold, cheesecake: 0, fossil: 0, gems: 0 };
    const response = await new FakeServer(state, { latencyMs: 0, now: () => now }).getIdleExcavation();
    expect(response.storageFillRatio).toBeCloseTo(ratio); expect(response.harvestNotice).toBe(notice);
  });

  it("수확 성공 응답은 지갑 전량 폐기 뒤에도 새 소수 잔량으로 알림을 해제한다", async () => {
    const state = makeSession(); const now = new Date("2026-08-20T00:00:00Z");
    state.wallet.gold = WALLET_CAPS.gold; state.idleExcavation.assignedRelicIds = ["anky", null, null]; state.idleExcavation.lastSettledAt = now.toISOString();
    state.idleExcavation.unclaimed = { gold: 53.55, cheesecake: 0, fossil: 0, gems: 0 };
    const response = await new FakeServer(state, { latencyMs: 0, now: () => now }).harvestExcavation({ requestId: "notice-discard" });
    expect(response.discarded.gold).toBe(53); expect(response.storageFillRatio).toBeCloseTo(0.55 / 107.1); expect(response.harvestNotice).toBe(false);
  });

  it("두 기기의 연속 수확처럼 서로 다른 요청은 첫 호출만 기존 누적량을 받는다", async () => {
    const state = makeSession(); state.idleExcavation.unclaimed = { gold: 20, cheesecake: 3, fossil: 0, gems: 0 };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T00:00:00Z") });
    const firstDevice = await server.harvestExcavation({ requestId: "device-a" });
    const secondDevice = await server.harvestExcavation({ requestId: "device-b" });
    expect(firstDevice.granted).toEqual({ gold: 20, cheesecake: 3, fossil: 0, gems: 0 });
    expect(secondDevice.granted).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0 });
    expect(state.wallet).toMatchObject({ gold: 20, cheesecake: 3, fossil: 1000, gems: 0 });
  });

  it("지갑이 이미 상한이면 지급량 0과 유실량을 구분해 반환한다", async () => {
    const state = makeSession(); state.wallet.gold = 999_999_999; state.wallet.cheesecake = 9_999_999;
    state.idleExcavation.unclaimed = { gold: 7, cheesecake: 2, fossil: 0, gems: 0 };
    const result = await new FakeServer(state, { latencyMs: 0 }).harvestExcavation({ requestId: "full-wallet" });
    expect(result.granted).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0 });
    expect(result.discarded).toEqual({ gold: 7, cheesecake: 2, fossil: 0, gems: 0 });
  });

  it("누적량 0 수확은 지갑을 바꾸지 않고 새 기준 시각을 확정한다", async () => {
    const state = makeSession(); const now = new Date("2026-08-20T05:00:00Z");
    const result = await new FakeServer(state, { latencyMs: 0, now: () => now }).harvestExcavation({ requestId: "empty" });
    expect(result.granted).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0 });
    expect(result.wallet).toEqual(state.wallet); expect(result.serverTime).toBe(now.toISOString());
    expect(result.excavation.lastSettledAt).toBe(now.toISOString());
  });

  it("장시간 미접속 생산은 저장 시간 상한까지만 정산한 뒤 한 번에 지급한다", async () => {
    const state = makeSession(); state.idleExcavation.assignedRelicIds = ["anky", null, null];
    state.idleExcavation.lastSettledAt = "2026-01-01T00:00:00Z";
    const result = await new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T00:00:00Z") }).harvestExcavation({ requestId: "long-away" });
    // 기본 저장 시간은 4시간이므로 수개월 경과를 그대로 곱하지 않는다.
    expect(result.granted.gold).toBe(107); expect(result.remaining.gold).toBe(0.1);
    expect(result.excavation.lastSettledAt).toBe("2026-08-20T00:00:00.000Z");
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
    const before = rune.mainStats[0].value;
    const response = await server.engraveRune({ runeInstanceId: "rune-1", statId: rune.mainStats[0].key });
    // 각인은 난수 등급이 아니라 **세공 성공 한 번과 같은 값**을 확정으로 더한다.
    const increase = runeEnhancementIncrease(rune.rarity, rune.mainStats[0].key);
    expect(response.rune.engravings).toEqual([{ statKey: rune.mainStats[0].key, valueAdded: increase }]);
    // 기록만 남기지 않고 그 옵션의 수치도 함께 오른다 — 화면과 전투 계산이 갈리지 않는다.
    expect(response.rune.mainStats[0].value).toBe(before + increase);
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
    expect(response.results).toEqual([{ type: "relic", relicId: "rex", kind: "fragment", fragments: 1, overflowFragments: 0 }]);
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
    expect(response.results[0]).toMatchObject({ type: "relic", kind: "new" });
    expect(response.results[1]).toMatchObject({ type: "relic", kind: "fragment", fragments: 1 });
    // 중복 아홉 장은 모두 그 개체의 파편이다. 별은 파편을 써서 플레이어가 직접 올린다.
    expect(state.relicProgress.rex).toMatchObject({ level: 1, breakthrough: 0 });
    expect(state.relicFragments.rex).toBe(9);
    expect(state.relicProgress.rex).toMatchObject({ bondLevel: 1, bondXp: 20 });
    expect(state.wallet.dnaFragments).toBe(0);
  });

  it("렐릭과 회색 재화가 섞인 10연을 순서대로 지급하고 지갑 상한을 적용한다", async () => {
    const state = makeSession();
    state.wallet.gold = 999_999_999 - 5;
    const rolls = [0.9, 0, 0, ...Array(40).fill(0)];
    let index = 0;
    const response = await new FakeServer(state, { latencyMs: 0, random: () => rolls[index++] ?? 0 }).pullRelics({ bannerId: "fossil", count: 10 });
    expect(response.results[0]).toEqual({ type: "currency", currency: "gold", amount: 1_000, grade: "GRAY" });
    expect(response.results.slice(1).every((result) => result.type === "relic")).toBe(true);
    expect(state.wallet.gold).toBe(999_999_999);
    expect(state.gachaPityByGroup["standard-fossil"].pullsSinceSsr).toBe(0);
  });

  it("저장 단위가 실패하면 비용·보상·천장을 메모리에 부분 반영하지 않는다", async () => {
    const state = makeSession();
    const before = { wallet: { ...state.wallet }, pity: { ...state.gachaPityByGroup } };
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0 });
    // 실제 저장 장애와 같은 위치에서 실패시켜 persist 성공 이후에만 커밋한다는 계약을 검증한다.
    (server as unknown as { persist: () => void }).persist = () => { throw new Error("save failed"); };
    await expect(server.pullRelics({ bannerId: "fossil", count: 1 })).rejects.toThrow("save failed");
    expect(state.wallet).toEqual(before.wallet);
    expect(state.gachaPityByGroup).toEqual(before.pity);
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
    await expect(server.claimMissionRewards(["daily-battle"])).resolves.toMatchObject({ claimedIds: ["daily-battle"], cheesecakeEarned: 30 });
    // 보상 수령 표시와 수식어 획득 ID가 같은 서버 확정 상태에 남는다.
    expect(state.earnedProfileModifierIds).toEqual(["field-pioneer"]);
    const afterFirstClaim = state.wallet.cheesecake;
    await expect(server.claimMissionRewards(["daily-battle"])).rejects.toMatchObject({ code: "MISSION_ALREADY_CLAIMED" });
    expect(state.wallet.cheesecake).toBe(afterFirstClaim);
  });

  it("임무와 새 연구도 단계를 한 처리로 지급하고 단계 재요청은 0원으로 멱등 처리한다", async () => {
    const state = makeSession(); const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T12:00:00Z") });
    await server.completeStage("1-1", true);
    const claimed = await server.claimMissionRewards(["daily-battle"]);
    expect(claimed).toMatchObject({ claimedIds: ["daily-battle"], claimedResearchStageIds: ["daily:research-20"], rewards: { missionCheesecake: 20, researchCheesecake: 10, cheesecake: 30 } });
    const before = state.wallet.cheesecake;
    await expect(server.claimMissionRewards([], "daily", ["research-20"])).resolves.toMatchObject({ cheesecakeEarned: 0, claimedResearchStageIds: [] });
    expect(state.wallet.cheesecake).toBe(before);
  });

  it("발굴·급여·로비 성공을 각 API 경계에서 임무에 한 번 반영한다", async () => {
    const state = makeSession(); state.wallet.cheesecake = 20;
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0, now: () => new Date("2026-08-20T12:00:00Z") });
    await server.pullRelics({ bannerId: "fossil", count: 1 });
    await server.feedRelic("anky", 1);
    await server.interactInLobby("anky");
    expect(state.missions.progress).toMatchObject({ "daily-excavate": 1, "daily-salary": 1, "daily-lobby": 1 });
    await expect(server.getMissions()).resolves.toMatchObject({ claimableCount: 6 });
  });
});

describe("FakeServer 상품 카탈로그", () => {
  it("여러 개의 총가격·총 지급량·구매 제한을 검증한 뒤 한 번에 확정한다", async () => {
    const state = makeSession(1_000);
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    const result = await server.purchaseProduct({ productId: "trade-weeds", quantity: 2 });
    // 단가와 단위 지급량에 수량을 곱한 결과와 제한 기록이 같은 응답 시점에 반영된다.
    expect(result).toMatchObject({ quantity: 2, remaining: 1, wallet: { fossil: 640, cheesecake: 200 }, granted: [{ kind: "currency", currency: "cheesecake", amount: 200 }] });
    expect(state.productPurchases["trade-weeds"]).toEqual({ periodKey: "2026-08-22", count: 2 });
    const before = { wallet: { ...state.wallet }, purchases: { ...state.productPurchases } };
    await expect(server.purchaseProduct({ productId: "trade-weeds", quantity: 2 })).rejects.toMatchObject({ code: "PURCHASE_LIMIT_REACHED" });
    expect(state.wallet).toEqual(before.wallet); expect(state.productPurchases).toEqual(before.purchases);
  });

  it("인게임 가격 차감, 지급, 일일 제한을 한 처리로 확정한다", async () => {
    const state = makeSession(1000);
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await expect(server.purchaseProduct({ productId: "trade-weeds", quantity: 1 })).resolves.toMatchObject({ productId: "trade-weeds", quantity: 1, remaining: 2, wallet: { fossil: 820, cheesecake: 100 } });
    expect(state.productPurchases["trade-weeds"]).toEqual({ periodKey: "2026-08-22", count: 1 });
    await server.purchaseProduct({ productId: "trade-weeds", quantity: 1 });
    await server.purchaseProduct({ productId: "trade-weeds", quantity: 1 });
    await expect(server.purchaseProduct({ productId: "trade-weeds", quantity: 1 })).rejects.toMatchObject({ code: "PURCHASE_LIMIT_REACHED" });
  });

  it("재화 부족과 유료 상품은 어떤 지급도 만들지 않는다", async () => {
    const state = makeSession(0); const before = { ...state.wallet };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await expect(server.purchaseProduct({ productId: "trade-weeds", quantity: 1 })).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
    await expect(server.purchaseProduct({ productId: "premium-starter", quantity: 1 })).rejects.toMatchObject({ code: "PLATFORM_PAYMENT_REQUIRED" });
    expect(state.wallet).toEqual(before);
    expect(state.productPurchases).toEqual({});
  });

  it("잘못된 수량은 차감 전에 거부한다", async () => {
    const state = makeSession(); const before = { ...state.wallet };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await expect(server.purchaseProduct({ productId: "trade-weeds", quantity: 0 })).rejects.toMatchObject({ code: "INVALID_PURCHASE_QUANTITY" });
    await expect(server.purchaseProduct({ productId: "trade-weeds", quantity: 1.5 })).rejects.toMatchObject({ code: "INVALID_PURCHASE_QUANTITY" });
    expect(state.wallet).toEqual(before); expect(state.productPurchases).toEqual({});
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
    expect(first).toMatchObject({ reward: { kind: "currency", currency: "stamina", amount: 10 }, dailyBonus: { currency: "gems", amount: 5 }, dailyRemaining: 2 });
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
    expect(result).toMatchObject({ reward: { kind: "currency", currency: "stamina", amount: 10 }, dailyClaims: 1, dailyRemaining: 2 });
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

  it("1.5배는 현재 확정 수확에 한 번만 적용하고 다음 수확에는 남지 않는다", async () => {
    const state = makeSession(); state.idleExcavation.unclaimed = { gold: 10, cheesecake: 2, fossil: 0, gems: 0 };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await server.claimAdReward({ slotId: "excavation-harvest", verificationToken: "verified:excavation-harvest", requestId: "boost-harvest" });
    const boosted = await server.harvestExcavation({ requestId: "boosted-harvest" });
    expect(boosted.granted).toEqual({ gold: 15, cheesecake: 3, fossil: 0, gems: 0 });
    state.idleExcavation.unclaimed = { gold: 10, cheesecake: 2, fossil: 0, gems: 0 };
    const normal = await server.harvestExcavation({ requestId: "normal-harvest" });
    expect(normal.granted).toEqual({ gold: 10, cheesecake: 2, fossil: 0, gems: 0 });
  });

  it("생산 1.5배는 중첩하지 않고 재수령 시 만료를 교체하며 만료 경계를 나눠 정산한다", async () => {
    const state = makeSession(); state.idleExcavation.assignedRelicIds = ["anky", null, null]; state.idleExcavation.lastSettledAt = "2026-08-22T12:00:00.000Z";
    let now = new Date("2026-08-22T12:00:00Z"); const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    await server.claimAdReward({ slotId: "excavation-speed", verificationToken: "verified:excavation-speed", requestId: "speed-1" });
    now = new Date("2026-08-22T12:30:00Z");
    await server.claimAdReward({ slotId: "excavation-speed", verificationToken: "verified:excavation-speed", requestId: "speed-2" });
    expect(state.idleExcavation.activeProductionMultiplier).toBe(1.5);
    expect(state.idleExcavation.productionMultiplierExpiresAt).toBe("2026-08-22T13:30:00.000Z");
    now = new Date("2026-08-22T14:00:00Z"); await server.getIdleExcavation();
    expect(state.idleExcavation.activeProductionMultiplier).toBe(1);
    expect(state.idleExcavation.productionMultiplierExpiresAt).toBeNull();
  });

  it("패스 즉시 수령도 발굴 효과와 슬롯별 UTC 제한을 그대로 적용한다", async () => {
    const state = makeSession(); const now = () => new Date("2026-08-22T12:00:00Z"); const server = new FakeServer(state, { latencyMs: 0, now });
    const verified = await server.verifyPurchaseReceipt({ productId: "premium-monthly", platform: "test", receipt: "verified-receipt:premium-monthly:boost", requestId: "verify-boost" });
    const { entitlement } = await server.activatePass({ verificationId: verified.verificationId, requestId: "activate-boost" });
    const result = await server.claimInstantAdReward({ entitlementId: entitlement.entitlementId, slotId: "excavation-storage", requestId: "instant-storage" });
    expect(result.reward).toMatchObject({ kind: "excavation_effect", effect: { kind: "storage_extension", maxStorageSeconds: 28_800 } });
    expect(state.idleExcavation.storageExtensionExpiresAt).toBe("2026-08-22T20:00:00.000Z");
  });
});

/** 원정 임시 보상과 빠른 원정은 서버 소유 값만으로 원자 지급된다. */
describe("FakeServer 원정 정산", () => {
  it("노드 재요청은 멱등이며 서버 보상만 pendingRewards에 저장한다", async () => {
    const state = makeSession();
    const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "dodo"]);
    const node = state.expedition.run!.nodes.find(({ floor }) => floor === 1)!;
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0 });
    const request = { requestId: "node-once", runId: state.expedition.run!.runId, nodeId: node.id, relicHp: [100, 90, 80] };
    const first = await server.completeExpeditionNode(request);
    const repeated = await server.completeExpeditionNode(request);
    expect(repeated).toEqual(first);
    expect(state.expedition.run!.visitedNodeIds.filter((id) => id === node.id)).toHaveLength(1);
    expect(state.expedition.run!.pendingRewards).toEqual(first.pendingRewards);
    await expect(server.completeExpeditionNode({ ...request, requestId: "node-forged-retry" })).rejects.toMatchObject({ code: "EXPEDITION_RUN_NOT_FOUND" });
  });

  it("일반 노드 클리어 재화는 주간 순위(bestScore)가 아니라 누적 점수에만 조금씩 쌓인다", async () => {
    const state = makeSession();
    const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "dodo"]);
    const node = state.expedition.run!.nodes.find(({ floor }) => floor === 1)!;
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0.5, now: () => new Date("2026-08-25T12:00:00Z") });
    const response = await server.completeExpeditionNode({ requestId: "node-score", runId: state.expedition.run!.runId, nodeId: node.id, relicHp: [100, 90, 80] });
    const expectedScore = Object.values(response.rewards).reduce((sum, amount) => sum + amount, 0);
    expect(expectedScore).toBeGreaterThan(0);
    const weekly = await server.getExpeditionWeeklyBest();
    expect(weekly.cumulativeScore).toBe(expectedScore);
    // 순위 산정 기준(bestScore)은 여전히 보스 피해량만 반영한다.
    expect(weekly.bestScore).toBe(0);
  });

  it("정산 뒤 새 편성을 열고 같은 정산 ID는 지갑을 다시 늘리지 않는다", async () => {
    const state = makeSession();
    state.wallet.gold = 999_999_998;
    const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
    const started = manager.start(["anky", "rex", "dodo"]); expect(started.ok).toBe(true);
    state.expedition.run!.pendingRewards = { gold: 50, fossil: 7 };
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
    const runId = state.expedition.run!.runId;
    const request = { runId, settlementId: "settlement-1", outcome: "abandoned" as const };
    const first = await server.settleExpeditionRun(request);
    expect(first.granted).toEqual({ gold: 1, fossil: 7 }); expect(state.expedition.run).toBeNull();
    const walletAfterFirst = { ...state.wallet };
    expect(await server.settleExpeditionRun(request)).toEqual(first);
    expect(state.wallet).toEqual(walletAfterFirst);
    // 활성 run이 null이므로 화면이 사용하는 동일 매니저 계약에서 곧바로 새 편성을 시작할 수 있다.
    expect(manager.status().active).toBeNull();
    expect(manager.start(["anky", "rex", "dodo"]).ok).toBe(true);
    await expect(server.settleExpeditionRun({ runId: first.runId, settlementId: "settlement-2", outcome: "completed" })).rejects.toMatchObject({ code: "EXPEDITION_RUN_NOT_FOUND" });
    expect(state.wallet).toMatchObject({ gold: 999_999_999, fossil: 1007 });
  });

  it("포기 정산은 런 점수를 주간 최고점에 반영하지 않고, 노드 진행 점수는 랭킹에도 반영하지 않는다", async () => {
    const state = makeSession();
    const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "dodo"]); state.expedition.run!.bestScore = 88_000; state.expedition.bestScore = 12_000;
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });

    await server.settleExpeditionRun({ runId: state.expedition.run!.runId, settlementId: "abandon-score", outcome: "abandoned" });
    expect(state.expedition.bestScore).toBe(12_000);
    expect(state.expedition.run).toBeNull();
    // 불사 보스는 처치가 불가능해 "완료"가 없다 — 주간 랭킹·역대 최고점은 노드 진행이 아니라
    // submitExpeditionBossScore가 제출하는 실제 피해량만으로 갱신된다.
    const weekly = await server.getExpeditionWeeklyBest();
    expect(weekly.bestScore).toBe(0); expect(weekly.cumulativeScore).toBe(0);
    expect(state.expedition.allTimeBestScore).toBe(0);
  });

  it("보스에게 입힌 피해량은 승패와 무관하게 주간 랭킹과 역대 최고점을 갱신한다", async () => {
    const state = makeSession();
    const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "dodo"]);
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
    const runId = state.expedition.run!.runId;
    const bossNode = state.expedition.run!.nodes.find(({ type }) => type === "boss")!;
    state.expedition.run!.bossSubmissionId = `${runId}:${bossNode.id}:boss-score`;
    // 실제 피해량 없이 각 렐릭의 공용 공속 쿨다운을 만족하는 기본 공격 입력이다.
    const bossActions = Array.from({ length: 5 }, (_, index) => ["anky", "rex", "dodo"].map((actorId) => ({ elapsedMs: index * 2_000, actorId, kind: "basic" as const }))).flat();
    const score = await server.submitExpeditionBossScore({ requestId: state.expedition.run!.bossSubmissionId, runId, nodeId: bossNode.id, actions: bossActions });
    manager.completeNode(bossNode.id, { relicHp: [0, 0, 0], score: score.score });

    // 팀이 전멸해 "패배"로 끝나도(불사 보스는 애초에 이길 수 없다) 이미 입힌 피해는 그대로 남는다.
    await server.settleExpeditionRun({ runId, settlementId: "boss-then-wipe", outcome: "abandoned" });
    const weekly = await server.getExpeditionWeeklyBest();
    expect(weekly.cumulativeScore).toBe(score.score);
    expect(weekly.bestScore).toBe(score.score);
    expect(state.expedition.allTimeBestScore).toBe(score.score);
  });

  it("20층 정상 완료 정산에서만 런 최고점을 주간 최고점으로 갱신한다", async () => {
    const state = makeSession();
    const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "dodo"]); state.expedition.run!.bestScore = 88_000; state.expedition.bestScore = 12_000;
    const server = new FakeServer(state, { latencyMs: 0 });

    await server.settleExpeditionRun({ runId: state.expedition.run!.runId, settlementId: "boss-complete", outcome: "completed" });
    expect(state.expedition.bestScore).toBe(88_000);
    expect(state.expedition.run).toBeNull();
  });

  describe("소탕", () => {
    it("역대 최고점의 80%를 주간 랭킹에, 노드 보상 상한의 50%를 지갑에 즉시 지급한다", async () => {
      const state = makeSession();
      state.expedition.allTimeBestScore = 10_000;
      const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
      const goldBefore = state.wallet.gold;

      const result = await server.sweepExpedition({ requestId: "sweep-1" });
      expect(result.scoreGain).toBe(8_000);
      expect(result.bestScore).toBe(8_000);
      expect(result.cumulativeScore).toBe(8_000);
      expect(result.granted.gold).toBe(3_750); // runCap 7,500의 50%
      expect(state.wallet.gold).toBe(goldBefore + 3_750);
      expect(state.expedition.playsThisWeek).toBe(1);
      const weekly = await server.getExpeditionWeeklyBest();
      expect(weekly.bestScore).toBe(8_000);
    });

    it("같은 요청 ID는 두 번째 호출에서도 같은 응답을 반환하고 다시 지급하지 않는다", async () => {
      const state = makeSession();
      state.expedition.allTimeBestScore = 10_000;
      const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
      const first = await server.sweepExpedition({ requestId: "sweep-idem" });
      const second = await server.sweepExpedition({ requestId: "sweep-idem" });
      expect(second).toEqual(first);
      expect(state.expedition.playsThisWeek).toBe(1);
    });

    it("참조할 역대 최고점이 없으면 거부한다", async () => {
      const server = new FakeServer(makeSession(), { latencyMs: 0 });
      await expect(server.sweepExpedition({ requestId: "sweep-none" })).rejects.toMatchObject({ code: "EXPEDITION_SCORE_REQUIRED" });
    });

    it("진행 중인 원정이 있으면 거부한다", async () => {
      const state = makeSession(); state.expedition.allTimeBestScore = 5_000;
      const manager = new (await import("../../src/managers/ExpeditionManager")).ExpeditionManager(state, { save: () => undefined }, () => new Date("2026-08-25T12:00:00Z"));
      manager.start(["anky", "rex", "dodo"]);
      const server = new FakeServer(state, { latencyMs: 0 });
      await expect(server.sweepExpedition({ requestId: "sweep-active" })).rejects.toMatchObject({ code: "EXPEDITION_ALREADY_ACTIVE" });
    });

    it("이번 주 원정 기회를 모두 쓰면 소탕도 거부한다", async () => {
      const state = makeSession();
      state.expedition.allTimeBestScore = 5_000;
      // 서버 시각과 같은 주차 키를 맞춰 둬야 소탕이 이 카운트를 새 주차로 착각해 초기화하지 않는다.
      state.expedition.weekKey = "2026-08-24";
      state.expedition.playsThisWeek = 2;
      const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-25T12:00:00Z") });
      await expect(server.sweepExpedition({ requestId: "sweep-limit" })).rejects.toMatchObject({ code: "EXPEDITION_WEEKLY_LIMIT" });
    });
  });

  it("기준 점수가 없으면 비활성·무보상이고 서버 최고 점수 비율과 일일 제한을 적용한다", async () => {
    const state = makeSession(); let now = new Date("2026-08-25T12:00:00Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    expect((await server.getAdOperationsConfig()).slots.find(({ slotId }) => slotId === "quick-expedition")).toMatchObject({ enabled: false, weeklyLimitUtc: 5, weeklyClaims: 0, referenceScore: 0 });
    await expect(server.claimAdReward({ slotId: "quick-expedition", verificationToken: "failed", requestId: "quick-fail" })).rejects.toMatchObject({ code: "AD_TOKEN_INVALID" });
    expect(state.wallet.gold).toBe(0);
    const quickActions = Array.from({ length: 5 }, (_, index) => ["anky", "rex", "dodo"].map((actorId) => ({ elapsedMs: index * 2_000, actorId, kind: "basic" as const }))).flat();
    await server.submitExpeditionBossScore({ requestId: "quick-score", actions: quickActions });
    const reference = (await server.getExpeditionWeeklyBest()).bestScore;
    const firstQuick = await server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-1" });
    expect(firstQuick).toMatchObject({ granted: { gold: Math.floor(reference * 0.25) }, weeklyRemaining: 4 });
    await server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-2" });
    expect(state.wallet.gold).toBe(Math.floor(reference * 0.25) * 2);
    await expect(server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-3" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    // 같은 UTC 주의 다음 날짜에도 누적 다섯 번을 넘을 수 없다.
    now = new Date("2026-08-26T12:00:00Z");
    await server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-3" });
    await server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-4" });
    now = new Date("2026-08-27T12:00:00Z");
    await server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-5" });
    await expect(server.claimAdReward({ slotId: "quick-expedition", verificationToken: "verified:quick-expedition", requestId: "quick-6" })).rejects.toMatchObject({ code: "AD_WEEKLY_LIMIT" });
    expect(state.wallet.gold).toBe(Math.floor(reference * 0.25) * 5);
  });
});

/** 판매 API의 트랜잭션·멱등·장착표 불변식을 실제 FakeServer 경계에서 고정한다. */
describe("룬 판매", () => {
  it("확정 지급 뒤 같은 requestId는 중복 지급하지 않는다", async () => {
    const state = makeSession(); state.runeInventory = [makeRune("sale-1")]; const server = new FakeServer(state, { latencyMs: 0 });
    const first = await server.sellRunes({ requestId: "sale-request", instanceIds: ["sale-1"] });
    const replay = await server.sellRunes({ requestId: "sale-request", instanceIds: ["sale-1"] });
    expect(replay).toEqual(first); expect(state.wallet.gold).toBe(first.goldAwarded); expect(state.runeInventory).toEqual([]);
  });

  it("장착 룬과 지갑 상한 초과를 원자적으로 거부해 장착표를 보존한다", async () => {
    const state = makeSession(); state.runeInventory = [makeRune("equipped-sale")]; state.relicProgress.anky.heartGemSlots[0] = "equipped-sale";
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.sellRunes({ requestId: "equipped", instanceIds: ["equipped-sale"] })).rejects.toMatchObject({ code: "RUNE_EQUIPPED" });
    expect(state.relicProgress.anky.heartGemSlots[0]).toBe("equipped-sale"); expect(state.runeInventory).toHaveLength(1);
    state.relicProgress.anky.heartGemSlots[0] = null; state.wallet.gold = 999_999_999;
    await expect(server.sellRunes({ requestId: "cap", instanceIds: ["equipped-sale"] })).rejects.toMatchObject({ code: "CURRENCY_LIMIT_EXCEEDED" });
    expect(state.runeInventory).toHaveLength(1); expect(state.wallet.gold).toBe(999_999_999);
  });

  it("잠근 룬은 판매를 거부하고 잠금을 푼 뒤에만 팔린다", async () => {
    const state = makeSession(); state.runeInventory = [makeRune("locked-sale")]; const server = new FakeServer(state, { latencyMs: 0 });
    await server.markRune({ runeInstanceId: "locked-sale", locked: true });
    await expect(server.sellRunes({ requestId: "locked", instanceIds: ["locked-sale"] })).rejects.toMatchObject({ code: "RUNE_LOCKED" });
    expect(state.runeInventory).toHaveLength(1);
    await server.markRune({ runeInstanceId: "locked-sale", locked: false });
    await server.sellRunes({ requestId: "unlocked", instanceIds: ["locked-sale"] });
    expect(state.runeInventory).toEqual([]);
  });
});

/** 두 표식이 한 스위치가 되지 않도록 서버 경계에서 부분 갱신을 고정한다. */
describe("룬 표식", () => {
  it("주지 않은 표식은 그대로 두고 준 표식만 바꾼다", async () => {
    const state = makeSession(); state.runeInventory = [makeRune("mark-1")]; const server = new FakeServer(state, { latencyMs: 0 });
    const locked = await server.markRune({ runeInstanceId: "mark-1", locked: true });
    expect(locked.rune).toMatchObject({ locked: true, bookmarked: false });
    const bookmarked = await server.markRune({ runeInstanceId: "mark-1", bookmarked: true });
    expect(bookmarked.rune).toMatchObject({ locked: true, bookmarked: true });
    expect(state.runeInventory[0]).toMatchObject({ locked: true, bookmarked: true });
    const unlocked = await server.markRune({ runeInstanceId: "mark-1", locked: false });
    expect(unlocked.rune).toMatchObject({ locked: false, bookmarked: true });
  });

  it("보유하지 않은 룬의 표식은 바꿀 수 없다", async () => {
    const state = makeSession(); state.runeInventory = [makeRune("mark-2")]; const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.markRune({ runeInstanceId: "없는 룬", locked: true })).rejects.toMatchObject({ code: "RUNE_NOT_FOUND" });
  });
});

describe("스테미나 충전 경계", () => {
  const source = staminaCurrencyRecharge("stamina-gems")!;

  it("는 값을 깎고 회복을 한 처리 단위로 확정한다", async () => {
    const state = makeSession();
    state.wallet = { ...state.wallet, gems: source.cost + 5, stamina: 0 };
    const server = new FakeServer(state, { latencyMs: 0 });
    const response = await server.rechargeStamina({ sourceId: source.id, requestId: "recharge-1" });
    // 값도 회복량도 화면이 아니라 표에서 나온다.
    expect(state.wallet.gems).toBe(5);
    expect(state.wallet.stamina).toBe(source.amount);
    expect(response).toMatchObject({ sourceId: source.id, appliedAmount: source.amount, overflowAmount: 0, spent: { currency: "gems", amount: source.cost } });
  });

  it("는 상한을 넘는 몫만 버리고 값은 그대로 받는다", async () => {
    const state = makeSession();
    const maximum = staminaMaxForPlayer(state);
    state.wallet = { ...state.wallet, gems: source.cost, stamina: maximum - 1 };
    const server = new FakeServer(state, { latencyMs: 0 });
    const response = await server.rechargeStamina({ sourceId: source.id, requestId: "recharge-2" });
    expect(state.wallet.stamina).toBe(maximum);
    expect(response.appliedAmount).toBe(1);
    expect(response.overflowAmount).toBe(source.amount - 1);
  });

  it("는 이미 가득 찼거나 재화가 모자라면 아무것도 바꾸지 않는다", async () => {
    const full = makeSession();
    full.wallet = { ...full.wallet, gems: source.cost, stamina: staminaMaxForPlayer(full) };
    // 헛돈을 쓰지 않도록 가득 찬 상태는 차감 전에 거절한다.
    await expect(new FakeServer(full, { latencyMs: 0 }).rechargeStamina({ sourceId: source.id, requestId: "recharge-3" }))
      .rejects.toMatchObject({ code: "STAMINA_FULL" });
    expect(full.wallet.gems).toBe(source.cost);

    const poor = makeSession();
    poor.wallet = { ...poor.wallet, gems: source.cost - 1, stamina: 0 };
    await expect(new FakeServer(poor, { latencyMs: 0 }).rechargeStamina({ sourceId: source.id, requestId: "recharge-4" }))
      .rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
    expect(poor.wallet.stamina).toBe(0);
  });

  it("는 표에 없는 수단 ID를 거부한다", async () => {
    // 화면이 보낸 문자열을 그대로 믿으면 값 없는 충전이 통과한다.
    await expect(new FakeServer(makeSession(), { latencyMs: 0 }).rechargeStamina({ sourceId: "stamina-free", requestId: "recharge-5" }))
      .rejects.toMatchObject({ code: "INVALID_EXCHANGE_TARGET" });
  });
});
