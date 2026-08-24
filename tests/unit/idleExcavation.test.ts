import { describe, expect, it } from "vitest";
import { createIdleExcavationState, harvestIdleExcavation, settleIdleExcavation } from "../../src/core/idleExcavation";
import { WALLET_CAPS } from "../../src/data/economy";

/** 테스트마다 같은 3인 편성과 UTC 기준점을 갖는 독립 상태를 만든다. */
function activeState() {
  return { ...createIdleExcavationState("2026-08-20T00:00:00.000Z"), assignedRelicIds: ["anky", "rex", "dodo"] as [string, string, string] };
}

describe("방치 발굴 순수 규칙", () => {
  it("앱을 종료한 4시간 동안 세 렐릭 생산량을 누적한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-20T04:00:00.000Z"));
    expect(result.unclaimed).toEqual({ fossil: 720, gold: 7200, cheesecake: 72 });
  });

  it("보관 상한을 넘긴 서버 경과 시간은 기본 4시간까지만 계산한다", () => {
    const result = settleIdleExcavation(activeState(), new Date("2026-08-21T00:00:00.000Z"));
    expect(result.unclaimed.fossil).toBe(720);
  });

  it("서버 시계가 역행하면 생산량과 마지막 정상 정산 시각을 유지한다", () => {
    const state = activeState(); const result = settleIdleExcavation(state, new Date("2026-08-19T23:00:00.000Z"));
    expect(result.unclaimed).toEqual(state.unclaimed); expect(result.lastSettledAt).toBe(state.lastSettledAt);
  });

  it("재화별 소수는 이월하고 지갑 상한 밖의 정수는 명시적으로 버린다", () => {
    const state = { ...activeState(), unclaimed: { fossil: 3.75, gold: 2.25, cheesecake: 1.5 } };
    const wallet = { fossil: WALLET_CAPS.fossil - 1, gold: WALLET_CAPS.gold, cheesecake: 0, amber: 0, gems: 0, stamina: 0, dnaFragments: 0 };
    const result = harvestIdleExcavation(state, wallet);
    expect(result.granted).toEqual({ fossil: 1, gold: 0, cheesecake: 1 });
    expect(result.discarded).toEqual({ fossil: 2, gold: 2, cheesecake: 0 });
    expect(result.state.unclaimed).toEqual({ fossil: 0.75, gold: 0.25, cheesecake: 0.5 });
  });
});
