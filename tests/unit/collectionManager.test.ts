import { describe, expect, it } from "vitest";
import type { Session } from "../../src/state/session";
import { RelicCollectionManager } from "../../src/managers/RelicCollectionManager";

/** 테스트끼리 진행 상태를 공유하지 않도록 가장 작은 독립 세션을 만든다. */
function makeSession(): Session {
  return {
    completedStoryIds: new Set(),
    selectedStageId: null,
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    bookmarked: new Set<string>(),
    pullCountSinceHighestRarity: { fossil: 0, amber: 0 },
    wallet: { fossil: 0, amber: 0, dnaFragments: 0, weeds: 0 },
    relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: 1, levelTitle: "복원체", dnaMastery: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }])),
    ownedHeartGemIds: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
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

  it("즐겨찾기는 여러 명을 담고 애착 렐릭과 섞이지 않는다", () => {
    const state = makeSession();
    const manager = new RelicCollectionManager(state);

    expect(manager.toggleBookmark("rex")).toBe(true);
    expect(manager.toggleBookmark("dodo")).toBe(true);
    expect(manager.isBookmarked("rex")).toBe(true);
    // 즐겨찾기를 바꿔도 로비에 서는 애착 렐릭은 그대로다.
    expect(state.favorite).toBe("anky");

    expect(manager.toggleBookmark("rex")).toBe(true);
    expect(manager.isBookmarked("rex")).toBe(false);
    expect(manager.isBookmarked("dodo")).toBe(true);
  });

  it("미보유 렐릭은 즐겨찾기에 담지 않는다", () => {
    const state = makeSession();
    const manager = new RelicCollectionManager(state);

    expect(manager.toggleBookmark("spino")).toBe(false);
    expect(state.bookmarked.size).toBe(0);
  });

  it("서로 다른 보유 렐릭 세 명만 파티로 확정한다", () => {
    const state = makeSession();
    const manager = new RelicCollectionManager(state);

    expect(manager.setParty(["rex", "dodo", "anky"])).toBe(true);
    expect(manager.setParty(["rex", "rex", "anky"])).toBe(false);
    expect(state.party).toEqual(["rex", "dodo", "anky"]);
  });
});
