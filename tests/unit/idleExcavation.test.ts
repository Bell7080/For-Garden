import { describe, expect, it } from "vitest";
import { emptyExcavationAmounts, excavationProductionDisplayModel, createIdleExcavationState, excavationStorageFillRatio, excavationStorageLimitSeconds, harvestIdleExcavation, nextExcavationSlot, placeExcavationRelic, settleIdleExcavation, validateExcavationFormation } from "../../src/core/idleExcavation";
import { WALLET_CAPS } from "../../src/data/economy";
import { RELICS } from "../../src/data/relics";
import type { RelicProgress } from "../../src/core/types";

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
    expect(model.totalsPerHour).toEqual({ gold: 105, cheesecake: 8.8, fossil: 26.4, gems: 0 });
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

  it("레벨과 한계 돌파만 생산 성장값에 반영한다", () => {
    const model = excavationProductionDisplayModel(["rex", null, null], RELICS, { rex: progress(11, 2) });
    expect(model.relics[0]).toMatchObject({ basePerHour: 26.4, levelIncreasePerHour: 5.28, breakthroughIncreasePerHour: 5.28, totalPerHour: 36.96 });
  });

  it("빈 슬롯은 생산 상세와 합산에서 제외한다", () => {
    expect(excavationProductionDisplayModel([null, "rex", null], RELICS, { rex: progress() })).toMatchObject({ relics: [{ relicId: "rex" }], totalsPerHour: { gold: 0, cheesecake: 0, fossil: 26.4, gems: 0 } });
  });

  it("앱을 종료한 4시간 동안 세 렐릭 생산량을 누적한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-20T04:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual({ gold: 420, cheesecake: 35.2, fossil: 105.6, gems: 0 });
  });

  it("화석 특화 렐릭의 신규 생산량을 독립적으로 정산한다", () => {
    const state = { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["rex", null, null] as [string, null, null] };
    expect(settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, { rex: progress() }).unclaimed).toEqual({ gold: 0, cheesecake: 0, fossil: 26.4, gems: 0 });
  });

  it("다이아 특화 렐릭의 신규 생산량을 독립적으로 정산한다", () => {
    const state = { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["dodo", null, null] as [string, null, null] };
    expect(settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, { dodo: progress() }).unclaimed).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0.2016 });
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
    expect(result.unclaimed).toEqual({ gold: 262.5, cheesecake: 22, fossil: 66, gems: 0 });
  });

  it("활성 보관 광고는 오프라인 생산 상한을 4시간에서 8시간으로 늘린다", () => {
    const state = { ...activeState(), storageExtensionExpiresAt: "2026-08-21T00:00:00.000Z" };
    expect(settleIdleExcavation(state, new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress).unclaimed.gold).toBe(840);
  });

  it("생산 배율 만료 시각 자체까지는 강화 구간으로 정확히 계산한다", () => {
    const state = { ...activeState(), activeProductionMultiplier: 1.5, productionMultiplierExpiresAt: "2026-08-20T01:00:00.000Z" };
    const result = settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(157.5);
    expect(result.productionMultiplierExpiresAt).toBeNull();
  });

  it("보관 상한을 넘긴 서버 경과 시간은 기본 4시간까지만 계산한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(420);
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
