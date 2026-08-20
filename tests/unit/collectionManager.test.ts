import { describe, expect, it } from "vitest";
import type { Session } from "../../src/state/session";
import { RelicCollectionManager } from "../../src/managers/RelicCollectionManager";

/** 테스트끼리 진행 상태를 공유하지 않도록 가장 작은 독립 세션을 만든다. */
function makeSession(): Session {
  return {
    selectedStageId: null,
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    pullCountSinceHighestRarity: { fossil: 0, amber: 0 },
    wallet: { fossil: 0, amber: 0, dnaFragments: 0 },
    relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: 1, levelTitle: "복원체", dnaMastery: 0, heartGemSlots: [null, null, null] }])),
    ownedHeartGemIds: [],
    dailyContent: { date: "", completedIds: [], claimedRewardIds: [] },
  };
}

describe("RelicCollectionManager", () => {
  it("미보유 렐릭을 애착 렐릭이나 파티에 넣지 않는다", () => {
    const state = makeSession();
    const manager = new RelicCollectionManager(state);

    expect(manager.setFavorite("spino")).toBe(false);
    expect(manager.setParty(["anky", "rex", "spino"])).toBe(false);
    expect(state.favorite).toBe("anky");
    expect(state.party).toEqual(["anky", "rex", "dodo"]);
  });

  it("서로 다른 보유 렐릭 세 명만 파티로 확정한다", () => {
    const state = makeSession();
    const manager = new RelicCollectionManager(state);

    expect(manager.setParty(["rex", "dodo", "anky"])).toBe(true);
    expect(manager.setParty(["rex", "rex", "anky"])).toBe(false);
    expect(state.party).toEqual(["rex", "dodo", "anky"]);
  });
});
