import { describe, expect, it } from "vitest";
import { emptyExcavationAmounts, excavationProductionDisplayModel, createIdleExcavationState, excavationHarvestStatus, excavationStorageFillRatio, excavationStorageLimitSeconds, harvestIdleExcavation, nextExcavationSlot, placeExcavationRelic, settleIdleExcavation, validateExcavationFormation } from "../../src/core/idleExcavation";
import { WALLET_CAPS } from "../../src/data/economy";
import { RELICS } from "../../src/data/relics";
import type { RelicProgress } from "../../src/core/types";
import { TIME_ACCRUAL_FIXTURES } from "../fixtures/timeAccrual";

/** 생산 공식과 무관한 성장 필드는 테스트에서 고정해 암묵적 전투 보정을 막는다. */
function progress(level = 1, breakthrough = 0): RelicProgress {
  return { level, breakthrough, exp: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
}

/** 테스트마다 같은 3인 편성과 UTC 기준점을 갖는 독립 상태를 만든다. */
function activeState() {
  return { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["anky", "rex", "spino"] as [string, string, string] };
}

const starterProgress = { anky: progress(), rex: progress(), spino: progress() };

describe("방치 발굴 순수 규칙", () => {
  it("공유 시계 fixture에서 시간대·역행·장기 오프라인·만료 경계를 지킨다", () => {
    const fixture = TIME_ACCRUAL_FIXTURES;
    const oneGoldPerHour = [{ ...RELICS[0], id: "fixture", excavationTrait: { primaryCurrency: "gold" as const, baseProductionPerHour: 1, efficiencyMultiplier: 1 } }];
    const settle = (lastSettledAt: string, serverNow: string, extra = {}) => settleIdleExcavation({ ...createIdleExcavationState(lastSettledAt), assignedRelicIds: ["fixture", null, null], ...extra }, new Date(serverNow), oneGoldPerHour, { fixture: progress() });
    // 오프셋 변경은 절대 시각 1시간, 장기 오프라인은 발굴 보관 상한 4시간까지만 생산한다.
    expect(settle(fixture.timezoneChange.lastSettledAt, fixture.timezoneChange.serverNow).unclaimed.gold).toBe(1);
    expect(settle(fixture.longOffline.lastSettledAt, fixture.longOffline.serverNow).unclaimed.gold).toBe(4);
    // 역행은 기준점을 보존하고 만료 시각까지의 한 시간만 강화 생산으로 센다.
    expect(settle(fixture.clockRegression.lastSettledAt, fixture.clockRegression.serverNow).lastSettledAt).toBe(fixture.clockRegression.lastSettledAt);
    expect(settle(fixture.expiryBoundary.lastSettledAt, fixture.expiryBoundary.serverNow, { activeProductionMultiplier: 2, productionMultiplierExpiresAt: fixture.expiryBoundary.expiresAt }).unclaimed.gold).toBe(2);
  });

  it("동일 캐릭터의 중복 배치를 차단한다", () => {
    expect(validateExcavationFormation(["rex", "rex", null], new Set(["rex"]))).toEqual({ valid: false, reason: "duplicate" });
  });

  it("미보유 캐릭터 배치를 차단한다", () => {
    expect(validateExcavationFormation(["rex", "dodo", null], new Set(["rex"]))).toEqual({ valid: false, reason: "unowned" });
  });

  it("배치된 렐릭을 빈 슬롯으로 옮기고 중복을 만들지 않는다", () => {
    expect(placeExcavationRelic(["rex", null, "spino"], 1, "rex")).toEqual([null, "rex", "spino"]);
  });

  it("차 있는 슬롯으로 옮기면 두 슬롯을 교체한다", () => {
    expect(placeExcavationRelic(["rex", "anky", null], 1, "rex")).toEqual(["anky", "rex", null]);
  });

  it("같은 슬롯을 다시 고르면 빈 슬롯으로 만들며 3칸 미완성도 유효하다", () => {
    const incomplete = placeExcavationRelic(["rex", "anky", null], 0, "rex");
    expect(incomplete).toEqual([null, "anky", null]);
    expect(validateExcavationFormation(incomplete, new Set(["rex", "anky"]))).toEqual({ valid: true });
  });

  it("서로 다른 자원 특화를 자원별로 합산한다", () => {
    const model = excavationProductionDisplayModel(activeState().assignedRelicIds, RELICS, starterProgress);
    expect(model.totalsPerHour).toEqual({ gold: 26.25, cheesecake: 0.88, fossil: 0.33, gems: 0 });
    expect(model.relics.map(({ currency }) => currency)).toEqual(["gold", "fossil", "cheesecake"]);
  });

  it("네 발굴 재화가 실제 렐릭 데이터에서 모두 생산된다", () => {
    const ids = ["anky", "spino", "rex", "dodo"];
    const model = excavationProductionDisplayModel(["anky", "spino", "rex"], RELICS, { anky: progress(), spino: progress(), rex: progress() });
    const diamond = excavationProductionDisplayModel(["dodo", null, null], RELICS, { dodo: progress(50, 4) });
    expect(new Set([...model.relics.map(({ currency }) => currency), diamond.relics[0].currency])).toEqual(new Set(["gold", "cheesecake", "fossil", "gems"]));
    // 다이아는 높은 성장에서도 시간당 1개 미만이며 정수 수확 전까지 소수로 남는다.
    expect(diamond.totalsPerHour.gems).toBeLessThan(1);
    expect(ids).toHaveLength(4);
  });

  it("생산 가능한 모든 렐릭은 1·중간·최대 성장에서 4시간 정수 하한을 지킨다", () => {
    for (const relic of RELICS) {
      const stages = [progress(1, 0), progress(30, 2), progress(60, 4)].map((value) => excavationProductionDisplayModel([relic.id, null, null], RELICS, { [relic.id]: value }).relics[0].totalPerHour);
      // 적 전용 0 생산 정의는 빈 편성과 같으므로 경제 하한에서 명시적으로 제외한다.
      if (relic.excavationTrait.baseProductionPerHour === 0) expect(stages).toEqual([0, 0, 0]);
      else expect(stages.every((perHour) => Math.floor(perHour * 4) >= 1), relic.id).toBe(true);
    }
  });

  it("레벨과 한계 돌파만 생산 성장값에 반영한다", () => {
    const model = excavationProductionDisplayModel(["rex", null, null], RELICS, { rex: progress(11, 2) });
    expect(model.relics[0]).toMatchObject({ basePerHour: 0.33, levelIncreasePerHour: 0.066, breakthroughIncreasePerHour: 0.066, totalPerHour: 0.462 });
  });

  it("빈 슬롯은 생산 상세와 합산에서 제외한다", () => {
    expect(excavationProductionDisplayModel([null, "rex", null], RELICS, { rex: progress() })).toMatchObject({ relics: [{ relicId: "rex" }], totalsPerHour: { gold: 0, cheesecake: 0, fossil: 0.33, gems: 0 } });
  });

  it("앱을 종료한 4시간 동안 세 렐릭 생산량을 누적한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-20T04:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual({ gold: 105, cheesecake: 3.52, fossil: 1.32, gems: 0 });
  });

  it("화석 특화 렐릭의 신규 생산량을 독립적으로 정산한다", () => {
    const state = { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["rex", null, null] as [string, null, null] };
    expect(settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, { rex: progress() }).unclaimed).toEqual({ gold: 0, cheesecake: 0, fossil: 0.33, gems: 0 });
  });

  it("다이아 특화 렐릭의 신규 생산량을 독립적으로 정산한다", () => {
    const state = { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["dodo", null, null] as [string, null, null] };
    expect(settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, { dodo: progress() }).unclaimed).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0.28 });
  });

  it("수확 뒤 네 재화의 소수 부분을 각각 다음 수확으로 이월한다", () => {
    const state = { ...createIdleExcavationState(), unclaimed: { gold: 1.1, cheesecake: 2.2, fossil: 3.3, gems: 4.4 } };
    const result = harvestIdleExcavation(state, { fossil: 0, gold: 0, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0 });
    expect(result.state.unclaimed).toEqual({ gold: 0.1, cheesecake: 0.2, fossil: 0.3, gems: 0.4 });
  });

  it("네 발굴 재화 모두 지갑 상한까지만 지급한다", () => {
    const state = { ...createIdleExcavationState(), unclaimed: { gold: 2, cheesecake: 2, fossil: 2, gems: 2 } };
    const wallet = { fossil: WALLET_CAPS.fossil - 1, gold: WALLET_CAPS.gold - 1, cheesecake: WALLET_CAPS.cheesecake - 1, amber: 0, gems: WALLET_CAPS.gems - 1, stamina: 0, dnaFragments: 0 };
    expect(harvestIdleExcavation(state, wallet).granted).toEqual({ gold: 1, cheesecake: 1, fossil: 1, gems: 1 });
  });

  it("활성 생산 광고는 만료 전 구간에만 1.5배를 적용한다", () => {
    const state = { ...activeState(), activeProductionMultiplier: 1.5, productionMultiplierExpiresAt: "2026-08-20T01:00:00.000Z" };
    const result = settleIdleExcavation(state, new Date("2026-08-20T02:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual({ gold: 65.625, cheesecake: 2.2, fossil: 0.825, gems: 0 });
  });

  it("활성 보관 광고는 오프라인 생산 상한을 4시간에서 8시간으로 늘린다", () => {
    const state = { ...activeState(), storageExtensionExpiresAt: "2026-08-21T00:00:00.000Z" };
    expect(settleIdleExcavation(state, new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress).unclaimed.gold).toBe(210);
  });

  it("생산 배율 만료 시각 자체까지는 강화 구간으로 정확히 계산한다", () => {
    const state = { ...activeState(), activeProductionMultiplier: 1.5, productionMultiplierExpiresAt: "2026-08-20T01:00:00.000Z" };
    const result = settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(39.375);
    expect(result.productionMultiplierExpiresAt).toBeNull();
  });

  it("보관 상한을 넘긴 서버 경과 시간은 기본 4시간까지만 계산한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(105);
  });

  it("서버 시계가 역행하면 생산량과 마지막 정상 정산 시각을 유지한다", () => {
    const state = activeState(); const result = settleIdleExcavation(state, new Date("2026-08-19T23:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual(state.unclaimed); expect(result.lastSettledAt).toBe(state.lastSettledAt);
  });

  it("재화별 소수는 이월하고 지갑 상한 밖의 정수는 명시적으로 버린다", () => {
    const state = { ...activeState(), unclaimed: { gold: 2.25, cheesecake: 1.5, fossil: 3.75, gems: 2.9 } };
    const wallet = { fossil: WALLET_CAPS.fossil - 1, gold: WALLET_CAPS.gold, cheesecake: 0, amber: 0, gems: WALLET_CAPS.gems, stamina: 0, dnaFragments: 0 };
    const result = harvestIdleExcavation(state, wallet);
    expect(result.granted).toEqual({ gold: 0, cheesecake: 1, fossil: 1, gems: 0 });
    expect(result.discarded).toEqual({ gold: 2, cheesecake: 0, fossil: 2, gems: 2 });
    expect(result.state.unclaimed).toEqual({ gold: 0.25, cheesecake: 0.5, fossil: 0.75, gems: 0.9 });
  });
});

describe("보관량 게이지", () => {
  it.each([[0.499, false], [0.5, true], [1, true]] as const)("비율 %s에서 정수 보상과 함께 알림을 판정한다", (ratio, expected) => {
    const rate = { ...emptyExcavationAmounts(), fossil: 10 };
    const unclaimed = { ...emptyExcavationAmounts(), fossil: 40 * ratio };
    expect(excavationHarvestStatus(unclaimed, rate, 4 * 3600)).toEqual({ storageFillRatio: ratio, harvestNotice: expected });
  });

  it("빈 편성과 50%여도 모든 재화가 1 미만인 편성은 알리지 않는다", () => {
    const empty = emptyExcavationAmounts();
    expect(excavationHarvestStatus(empty, empty, 4 * 3600)).toEqual({ storageFillRatio: 0, harvestNotice: false });
    // 보석 0.1/h의 4시간 용량 절반은 0.2라 비율만으로 수확점을 켜면 빈 수확을 유도한다.
    const rate = { ...empty, gems: 0.1 }; const unclaimed = { ...empty, gems: 0.2 };
    expect(excavationHarvestStatus(unclaimed, rate, 4 * 3600)).toEqual({ storageFillRatio: 0.5, harvestNotice: false });
  });

  it("광고 수확 배율로 정수가 되는 보상은 알리고 성공 수확 뒤 소수 잔량에서는 해제한다", () => {
    const rate = { ...emptyExcavationAmounts(), gems: 0.25 }; const unclaimed = { ...emptyExcavationAmounts(), gems: 0.6 };
    expect(excavationHarvestStatus(unclaimed, rate, 4 * 3600, 2).harvestNotice).toBe(true);
    const harvested = harvestIdleExcavation({ ...createIdleExcavationState(), unclaimed, pendingHarvestMultiplier: 2 }, { fossil: 0, gold: 0, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0 });
    expect(excavationHarvestStatus(harvested.state.unclaimed, rate, 4 * 3600).harvestNotice).toBe(false);
  });

  it("보관 확장 만료 후 기본 용량으로 돌아가며 지갑 전량 폐기도 성공 수확 뒤 알림을 해제한다", () => {
    const rate = { ...emptyExcavationAmounts(), gold: 10 }; const unclaimed = { ...emptyExcavationAmounts(), gold: 20 };
    expect(excavationHarvestStatus(unclaimed, rate, 8 * 3600).storageFillRatio).toBe(0.25);
    expect(excavationHarvestStatus(unclaimed, rate, 4 * 3600).harvestNotice).toBe(true);
    const fullWallet = { fossil: 0, gold: WALLET_CAPS.gold, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0 };
    const harvested = harvestIdleExcavation({ ...createIdleExcavationState(), unclaimed }, fullWallet);
    expect(harvested.discarded.gold).toBe(20);
    expect(excavationHarvestStatus(harvested.state.unclaimed, rate, 4 * 3600).harvestNotice).toBe(false);
  });

  it("은 경과 시간이 아니라 실제 쌓인 재화량으로 채운 비율을 계산한다", () => {
    // 시간당 10씩 4시간(14400초) 채우면 최대 40이 쌓인다. 20이 쌓였으면 절반이다.
    const rate = { ...emptyExcavationAmounts(), fossil: 10 };
    const unclaimed = { ...emptyExcavationAmounts(), fossil: 20 };
    expect(excavationStorageFillRatio(unclaimed, rate, 4 * 3600)).toBeCloseTo(0.5);
  });

  it("은 조회(정산)를 여러 번 반복해도 값이 그대로다 — 경과 시간 기준의 회귀를 막는다", () => {
    // 정산은 lastSettledAt을 매번 지금으로 밀지만, 쌓인 재화량 자체는 그대로다.
    const rate = { ...emptyExcavationAmounts(), gold: 25 };
    const unclaimed = { ...emptyExcavationAmounts(), gold: 100 };
    const ratio = excavationStorageFillRatio(unclaimed, rate, 4 * 3600);
    expect(excavationStorageFillRatio(unclaimed, rate, 4 * 3600)).toBe(ratio);
    expect(ratio).toBeCloseTo(100 / (25 * 4));
  });

  it("은 여러 재화 중 가장 많이 찬 재화 기준으로 비율을 잡고 1을 넘지 않는다", () => {
    const rate = { ...emptyExcavationAmounts(), gold: 10, cheesecake: 10 };
    const unclaimed = { ...emptyExcavationAmounts(), gold: 100, cheesecake: 10 };
    expect(excavationStorageFillRatio(unclaimed, rate, 3600)).toBe(1);
  });

  it("확장권이 활성인 동안에는 한도가 두 배다", () => {
    const state = { ...activeState(), storageExtensionExpiresAt: "2026-08-20T04:00:00.000Z" };
    expect(excavationStorageLimitSeconds(state, new Date("2026-08-20T01:00:00.000Z"))).toBe(state.baseStorageSeconds * 2);
    // 만료 이후에는 원래 한도로 돌아온다.
    expect(excavationStorageLimitSeconds(state, new Date("2026-08-20T05:00:00.000Z"))).toBe(state.baseStorageSeconds);
  });
});

describe("배치 뒤 다음 칸", () => {
  it("바로 뒤의 빈 칸으로 이어진다", () => {
    expect(nextExcavationSlot(["anky", null, null], 0)).toBe(1);
    expect(nextExcavationSlot(["anky", "rex", null], 1)).toBe(2);
  });

  it("뒤가 차 있으면 앞쪽 빈 칸으로 돌아온다", () => {
    expect(nextExcavationSlot([null, "rex", "spino"], 2)).toBe(0);
    expect(nextExcavationSlot(["anky", null, "spino"], 2)).toBe(1);
  });

  it("세 칸이 모두 차면 다음 칸에 그대로 머문다", () => {
    expect(nextExcavationSlot(["anky", "rex", "spino"], 0)).toBe(1);
    expect(nextExcavationSlot(["anky", "rex", "spino"], 2)).toBe(0);
  });
});
