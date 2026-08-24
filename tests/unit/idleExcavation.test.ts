import { describe, expect, it } from "vitest";
import { excavationProductionDisplayModel, createIdleExcavationState, harvestIdleExcavation, settleIdleExcavation, validateExcavationFormation } from "../../src/core/idleExcavation";
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

  it("서로 다른 자원 특화를 자원별로 합산한다", () => {
    const model = excavationProductionDisplayModel(activeState().assignedRelicIds, RELICS, starterProgress);
    expect(model.totalsPerHour).toEqual({ gold: 237, cheesecake: 8.8 });
    expect(model.relics.map(({ currency }) => currency)).toEqual(["gold", "gold", "cheesecake"]);
  });

  it("레벨과 한계 돌파만 생산 성장값에 반영한다", () => {
    const model = excavationProductionDisplayModel(["rex", null, null], RELICS, { rex: progress(11, 2) });
    expect(model.relics[0]).toMatchObject({ basePerHour: 132, levelIncreasePerHour: 26.4, breakthroughIncreasePerHour: 26.4, totalPerHour: 184.8 });
  });

  it("빈 슬롯은 생산 상세와 합산에서 제외한다", () => {
    expect(excavationProductionDisplayModel([null, "rex", null], RELICS, { rex: progress() })).toMatchObject({ relics: [{ relicId: "rex" }], totalsPerHour: { gold: 132, cheesecake: 0 } });
  });

  it("앱을 종료한 4시간 동안 세 렐릭 생산량을 누적한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-20T04:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual({ gold: 948, cheesecake: 35.2 });
  });

  it("보관 상한을 넘긴 서버 경과 시간은 기본 4시간까지만 계산한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-21T00:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed.gold).toBe(948);
  });

  it("서버 시계가 역행하면 생산량과 마지막 정상 정산 시각을 유지한다", () => {
    const state = activeState(); const result = settleIdleExcavation(state, new Date("2026-08-19T23:00:00.000Z"), RELICS, starterProgress);
    expect(result.unclaimed).toEqual(state.unclaimed); expect(result.lastSettledAt).toBe(state.lastSettledAt);
  });

  it("재화별 소수는 이월하고 지갑 상한 밖의 정수는 명시적으로 버린다", () => {
    const state = { ...activeState(), unclaimed: { gold: 2.25, cheesecake: 1.5 } };
    const wallet = { fossil: 0, gold: WALLET_CAPS.gold, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0 };
    const result = harvestIdleExcavation(state, wallet);
    expect(result.granted).toEqual({ gold: 0, cheesecake: 1 });
    expect(result.discarded).toEqual({ gold: 2, cheesecake: 0 });
    expect(result.state.unclaimed).toEqual({ gold: 0.25, cheesecake: 0.5 });
  });
});
