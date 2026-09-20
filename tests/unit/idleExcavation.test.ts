import { describe, expect, it } from "vitest";
import { emptyExcavationAmounts, EXCAVATION_BASE_STORAGE_SECONDS, EXCAVATION_CURRENCIES, excavationProductionDisplayModel, createIdleExcavationState, excavationHarvestStatus, excavationStorageFillRatio, excavationStorageLimitSeconds, harvestIdleExcavation, settleIdleExcavation, validateExcavationFormation } from "../../src/core/idleExcavation";
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

/** 기본 편성(토리카·렉시아·스피나)의 시간당 합산. 게이지의 분모를 손으로 적지 않는다. */
const TOTALS = excavationProductionDisplayModel(["anky", "rex", "spino"], RELICS, starterProgress).totalsPerHour;

const emptyWallet = { fossil: 0, gold: 0, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0, rawStone: 0, raidSigil: 0, salvageRecord: 0 };

describe("방치 발굴 순수 규칙", () => {
  it("공유 시계 fixture에서 시간대·역행·장기 오프라인·만료 경계를 지킨다", () => {
    const fixture = TIME_ACCRUAL_FIXTURES;
    const oneGoldPerHour = [{ ...RELICS[0], id: "fixture", excavationTrait: { primaryCurrency: "gold" as const, baseProductionPerHour: 1, efficiencyMultiplier: 1 } }];
    const settle = (lastSettledAt: string, serverNow: string, extra = {}) => settleIdleExcavation({ ...createIdleExcavationState(lastSettledAt), assignedRelicIds: ["fixture", null, null], ...extra }, new Date(serverNow), oneGoldPerHour, { fixture: progress() });
    // 오프셋 변경은 절대 시각 1시간, 장기 오프라인은 발굴 보관 상한 8시간까지만 생산한다.
    expect(settle(fixture.timezoneChange.lastSettledAt, fixture.timezoneChange.serverNow).unclaimed.gold).toBe(1);
    expect(settle(fixture.longOffline.lastSettledAt, fixture.longOffline.serverNow).unclaimed.gold).toBe(8);
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

  it("3칸이 다 차지 않은 편성도 유효하다", () => {
    // 자리를 고르는 규칙 자체는 formationSlots.test.ts가 지킨다. 여기서는 그 결과가 발굴 편성
    // 검증을 그대로 통과하는지만 본다.
    expect(validateExcavationFormation([null, "anky", null], new Set(["rex", "anky"]))).toEqual({ valid: true });
  });

  it("서로 다른 자원 특화를 자원별로 합산한다", () => {
    const model = excavationProductionDisplayModel(activeState().assignedRelicIds, RELICS, starterProgress);
    expect(model.totalsPerHour).toEqual({ gold: 131.25, cheesecake: 2.64, rawStone: 1.32, gems: 0 });
    expect(model.relics.map(({ currency }) => currency)).toEqual(["gold", "rawStone", "cheesecake"]);
  });

  it("네 발굴 재화가 실제 렐릭 데이터에서 모두 생산된다", () => {
    const ids = ["anky", "spino", "rex", "dodo"];
    const model = excavationProductionDisplayModel(["anky", "spino", "rex"], RELICS, { anky: progress(), spino: progress(), rex: progress() });
    const diamond = excavationProductionDisplayModel(["dodo", null, null], RELICS, { dodo: progress(50, 4) });
    expect(new Set([...model.relics.map(({ currency }) => currency), diamond.relics[0].currency])).toEqual(new Set(["gold", "cheesecake", "rawStone", "gems"]));
    // 다이아는 높은 성장에서도 시간당 1개 미만이며 정수 수확 전까지 소수로 남는다.
    expect(diamond.totalsPerHour.gems).toBeLessThan(1);
    expect(ids).toHaveLength(4);
  });

  /**
   * **한 칸이 기본 보관 시간 안에 최소 네 개를 담아야 한다.**
   *
   * 수확은 정수 단위라 걷을 때마다 1 미만이 남는다. 한도가 그 잔량과 비슷한 크기(화석 1.32)면
   * 남은 몫이 한도의 절반을 차지해 "수확했는데 게이지가 그대로"로 보인다 — v0.126.1까지 그랬다.
   * 넷을 담으면 잔량이 한도의 4분의 1 아래로 내려가 게이지가 눈에 띄게 비워진다.
   */
  it("생산 가능한 모든 렐릭은 1·중간·최대 성장에서 기본 보관 한도의 정수 하한을 지킨다", () => {
    const MINIMUM_UNITS = 4;
    for (const relic of RELICS) {
      const stages = [progress(1, 0), progress(30, 2), progress(60, 4)].map((value) => excavationProductionDisplayModel([relic.id, null, null], RELICS, { [relic.id]: value }).relics[0].totalPerHour);
      // 적 전용 0 생산 정의는 빈 편성과 같으므로 경제 하한에서 명시적으로 제외한다.
      if (relic.excavationTrait.baseProductionPerHour === 0) { expect(stages).toEqual([0, 0, 0]); continue; }
      const capacity = stages.map((perHour) => (perHour / 3600) * EXCAVATION_BASE_STORAGE_SECONDS);
      expect(Math.min(...capacity) >= MINIMUM_UNITS, `${relic.id} ${Math.min(...capacity)}`).toBe(true);
    }
  });

  /**
   * **하루 공급의 30% 언저리**(`docs/economy-design.md`의 발굴 공급표).
   *
   * 방치 발굴은 오래 임무·스토리보다 한참 아래에 있었다 — 화석 특화 세 칸을 다 채워도 하루
   * 8개, 뽑기 한 번(100)에 열이틀이 걸려 칸을 고를 이유가 없었다. 임무를 대신할 만큼 커지면
   * 접속해서 할 일이 사라지므로 위아래를 함께 묶는다. 기준은 세 칸을 그 재화로 채우고 하루에
   * 두세 번 걷는(20시간을 담는) 1레벨이다.
   */
  it("재화마다 세 칸 하루 공급이 설계한 띠 안에 든다", () => {
    const HOURS_PER_DAY = 20;
    const BANDS: Readonly<Record<string, readonly [number, number]>> = {
      // 원정 1런 상한(7,500)과 같은 자릿수. 골드는 룬 세공 말고 큰 소비처가 없어 넉넉하다.
      gold: [7_000, 13_000],
      // 임무·이벤트가 주는 하루 493개의 25~40%.
      cheesecake: [120, 200],
      // 지층 탐사 한 판(칸마다 6~26, 8~10회)이 100개 남짓이라 그 한 판 언저리로 묶는다.
      rawStone: [70, 110],
      // 유료 재화라 무과금 공급을 하루 20개대로 묶는다(스테미나 충전 한 번이 30).
      gems: [15, 35],
    };
    for (const currency of EXCAVATION_CURRENCIES) {
      const best = RELICS
        .filter((relic) => relic.excavationTrait.primaryCurrency === currency && relic.excavationTrait.baseProductionPerHour > 0)
        .map((relic) => excavationProductionDisplayModel([relic.id, null, null], RELICS, { [relic.id]: progress() }).totalsPerHour[currency])
        .sort((left, right) => right - left)
        .slice(0, 3);
      const perDay = best.reduce((sum, perHour) => sum + perHour, 0) * HOURS_PER_DAY;
      const [low, high] = BANDS[currency];
      expect(perDay, `${currency} ${perDay}`).toBeGreaterThanOrEqual(low);
      expect(perDay, `${currency} ${perDay}`).toBeLessThanOrEqual(high);
    }
  });

  it("레벨과 한계 돌파만 생산 성장값에 반영한다", () => {
    const model = excavationProductionDisplayModel(["rex", null, null], RELICS, { rex: progress(11, 2) });
    expect(model.relics[0]).toMatchObject({ basePerHour: 1.32, levelIncreasePerHour: 0.264, breakthroughIncreasePerHour: 0.264, totalPerHour: 1.848 });
  });

  it("빈 슬롯은 생산 상세와 합산에서 제외한다", () => {
    expect(excavationProductionDisplayModel([null, "rex", null], RELICS, { rex: progress() })).toMatchObject({ relics: [{ relicId: "rex" }], totalsPerHour: { gold: 0, cheesecake: 0, rawStone: 1.32, gems: 0 } });
  });

  it("앱을 종료한 4시간 동안 세 렐릭 생산량을 누적한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-20T04:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual({ gold: 525, cheesecake: 10.56, rawStone: 5.28, gems: 0 });
  });

  it("화석 특화 렐릭의 신규 생산량을 독립적으로 정산한다", () => {
    const state = { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["rex", null, null] as [string, null, null] };
    expect(settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, { rex: progress() }).unclaimed).toEqual({ gold: 0, cheesecake: 0, rawStone: 1.32, gems: 0 });
  });

  it("다이아 특화 렐릭의 신규 생산량을 독립적으로 정산한다", () => {
    const state = { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["dodo", null, null] as [string, null, null] };
    expect(settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, { dodo: progress() }).unclaimed).toEqual({ gold: 0, cheesecake: 0, rawStone: 0, gems: 0.56 });
  });

  it("수확 뒤 네 재화의 소수 부분을 각각 다음 수확으로 이월한다", () => {
    const state = { ...createIdleExcavationState(), unclaimed: { gold: 1.1, cheesecake: 2.2, rawStone: 3.3, gems: 4.4 } };
    const result = harvestIdleExcavation(state, { fossil: 0, gold: 0, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0, rawStone: 0, raidSigil: 0, salvageRecord: 0 });
    expect(result.state.unclaimed).toEqual({ gold: 0.1, cheesecake: 0.2, rawStone: 0.3, gems: 0.4 });
  });

  it("네 발굴 재화 모두 지갑 상한까지만 지급한다", () => {
    const state = { ...createIdleExcavationState(), unclaimed: { gold: 2, cheesecake: 2, rawStone: 2, gems: 2 } };
    const wallet = { fossil: 0, gold: WALLET_CAPS.gold - 1, cheesecake: WALLET_CAPS.cheesecake - 1, amber: 0, gems: WALLET_CAPS.gems - 1, stamina: 0, dnaFragments: 0, rawStone: WALLET_CAPS.rawStone - 1, raidSigil: 0, salvageRecord: 0 };
    expect(harvestIdleExcavation(state, wallet).granted).toEqual({ gold: 1, cheesecake: 1, rawStone: 1, gems: 1 });
  });

  it("활성 생산 광고는 만료 전 구간에만 1.5배를 적용한다", () => {
    const state = { ...activeState(), activeProductionMultiplier: 1.5, productionMultiplierExpiresAt: "2026-08-20T01:00:00.000Z" };
    const result = settleIdleExcavation(state, new Date("2026-08-20T02:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual({ gold: 328.125, cheesecake: 6.6, rawStone: 3.3, gems: 0 });
  });

  it("활성 보관 광고는 오프라인 생산 상한을 두 배로 늘린다", () => {
    const state = { ...activeState(), storageExtensionExpiresAt: "2026-08-21T00:00:00.000Z" };
    // 기본 8시간 × 2 = 16시간치. 131.25/h × 16 = 2,100이다.
    expect(settleIdleExcavation(state, new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress).unclaimed.gold).toBe(2_100);
  });

  it("생산 배율 만료 시각 자체까지는 강화 구간으로 정확히 계산한다", () => {
    const state = { ...activeState(), activeProductionMultiplier: 1.5, productionMultiplierExpiresAt: "2026-08-20T01:00:00.000Z" };
    const result = settleIdleExcavation(state, new Date("2026-08-20T01:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(196.875);
    expect(result.productionMultiplierExpiresAt).toBeNull();
  });

  it("보관 상한을 넘긴 서버 경과 시간은 기본 8시간까지만 계산한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(1_050);
  });

  /**
   * **한 번의 정산을 4시간으로 자르는 것만으로는 한도가 되지 않았다.**
   *
   * 8시간마다 앱을 열면 그때마다 4시간치가 더해져 하루면 한도의 세 배가 쌓였고, 게이지는
   * 100%에서 잘려 그 사이 아무 말도 하지 못했다. 그래서 수확해도 남는 소수가 커져 게이지가
   * 그대로인 것처럼 보였다.
   */
  it("정산을 여러 번 반복해도 보관 한도 위로는 쌓이지 않는다", () => {
    let state: ReturnType<typeof settleIdleExcavation> = activeState();
    for (const at of ["2026-08-20T08:00:00.000Z", "2026-08-20T16:00:00.000Z", "2026-08-21T00:00:00.000Z"]) {
      state = settleIdleExcavation(state, new Date(at), RELICS, starterProgress);
    }
    // 131.25/h × 8h = 1,050. 세 번을 열어도 3,150이 아니라 1,050이다.
    expect(state.unclaimed.gold).toBe(1_050);
    expect(state.unclaimed.rawStone).toBeCloseTo(1.32 * 8, 6);
    // 한도에서 멈추므로 수확 뒤 남는 것은 정수에 못 미친 몫뿐이고 게이지가 실제로 내려간다.
    const before = excavationStorageFillRatio(state.unclaimed, TOTALS, EXCAVATION_BASE_STORAGE_SECONDS);
    const after = harvestIdleExcavation(state, { ...emptyWallet }).state;
    expect(before).toBe(1);
    expect(excavationStorageFillRatio(after.unclaimed, TOTALS, EXCAVATION_BASE_STORAGE_SECONDS)).toBeLessThan(0.1);
  });

  /**
   * 한도가 줄어드는 길은 둘이다 — 그 재화를 캐던 렐릭을 편성에서 빼거나, 확장권이 끝나거나.
   * 그때 담긴 것을 잘라 내면 수확하기도 전에 사라지므로, 막는 것은 **새로 쌓는 몫**뿐이다.
   */
  it("한도가 줄어도 이미 담긴 것은 줄이지 않는다", () => {
    const stored = { ...emptyExcavationAmounts(), gold: 500 };
    // 금을 캐던 렐릭을 모두 뺀 편성이라 시간당 생산도 한도도 0이다.
    const emptied = settleIdleExcavation(
      { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: [null, null, null], unclaimed: stored },
      new Date("2026-08-20T04:00:00.000Z"), RELICS, starterProgress,
    );
    expect(emptied.unclaimed.gold).toBe(500);
  });

  it("서버 시계가 역행하면 생산량과 마지막 정상 정산 시각을 유지한다", () => {
    const state = activeState(); const result = settleIdleExcavation(state, new Date("2026-08-19T23:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual(state.unclaimed); expect(result.lastSettledAt).toBe(state.lastSettledAt);
  });

  it("재화별 소수는 이월하고 지갑 상한 밖의 정수는 명시적으로 버린다", () => {
    const state = { ...activeState(), unclaimed: { gold: 2.25, cheesecake: 1.5, rawStone: 3.75, gems: 2.9 } };
    const wallet = { fossil: 0, gold: WALLET_CAPS.gold, cheesecake: 0, amber: 0, gems: WALLET_CAPS.gems, stamina: 0, dnaFragments: 0, rawStone: WALLET_CAPS.rawStone - 1, raidSigil: 0, salvageRecord: 0 };
    const result = harvestIdleExcavation(state, wallet);
    expect(result.granted).toEqual({ gold: 0, cheesecake: 1, rawStone: 1, gems: 0 });
    expect(result.discarded).toEqual({ gold: 2, cheesecake: 0, rawStone: 2, gems: 2 });
    expect(result.state.unclaimed).toEqual({ gold: 0.25, cheesecake: 0.5, rawStone: 0.75, gems: 0.9 });
  });
});

describe("보관량 게이지", () => {
  it.each([[0.499, false], [0.5, true], [1, true]] as const)("비율 %s에서 정수 보상과 함께 알림을 판정한다", (ratio, expected) => {
    const rate = { ...emptyExcavationAmounts(), rawStone: 10 };
    const unclaimed = { ...emptyExcavationAmounts(), rawStone: 40 * ratio };
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
    const harvested = harvestIdleExcavation({ ...createIdleExcavationState(), unclaimed, pendingHarvestMultiplier: 2 }, { fossil: 0, gold: 0, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0, rawStone: 0, raidSigil: 0, salvageRecord: 0 });
    expect(excavationHarvestStatus(harvested.state.unclaimed, rate, 4 * 3600).harvestNotice).toBe(false);
  });

  it("보관 확장 만료 후 기본 용량으로 돌아가며 지갑 전량 폐기도 성공 수확 뒤 알림을 해제한다", () => {
    const rate = { ...emptyExcavationAmounts(), gold: 10 }; const unclaimed = { ...emptyExcavationAmounts(), gold: 20 };
    expect(excavationHarvestStatus(unclaimed, rate, 8 * 3600).storageFillRatio).toBe(0.25);
    expect(excavationHarvestStatus(unclaimed, rate, 4 * 3600).harvestNotice).toBe(true);
    const fullWallet = { fossil: 0, gold: WALLET_CAPS.gold, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0, rawStone: 0, raidSigil: 0, salvageRecord: 0 };
    const harvested = harvestIdleExcavation({ ...createIdleExcavationState(), unclaimed }, fullWallet);
    expect(harvested.discarded.gold).toBe(20);
    expect(excavationHarvestStatus(harvested.state.unclaimed, rate, 4 * 3600).harvestNotice).toBe(false);
  });

  it("은 경과 시간이 아니라 실제 쌓인 재화량으로 채운 비율을 계산한다", () => {
    // 시간당 10씩 4시간(14400초) 채우면 최대 40이 쌓인다. 20이 쌓였으면 절반이다.
    const rate = { ...emptyExcavationAmounts(), rawStone: 10 };
    const unclaimed = { ...emptyExcavationAmounts(), rawStone: 20 };
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
