import { describe, expect, it } from "vitest";
import type { Session } from "../../src/state/session";
import { RelicCollectionManager } from "../../src/managers/RelicCollectionManager";
import { createDefaultSettings } from "../../src/core/settings";

/** 테스트끼리 진행 상태를 공유하지 않도록 가장 작은 독립 세션을 만든다. */
function makeSession(): Session {
  return {
    // 이 테스트는 발굴을 다루지 않지만 최신 Session 계약의 빈 서버 정산 상태를 명시한다.
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
    wallet: { fossil: 0, amber: 0, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 },
    relicFragments: {}, relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] }])),
    itemInventory: [],
    runeInventory: [],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] },
    // 상품 테스트가 아닌 세션도 최신 저장 계약의 빈 구매 이력을 명시한다.
    productPurchases: {},
    // 테스트 계정은 광고 수령 이력이 없는 UTC 일일 상태로 시작한다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
  };
}

describe("RelicCollectionManager", () => {
  it("미보유 렐릭을 애착 렐릭이나 파티에 넣지 않는다", () => {
    const state = makeSession();
    const manager = new RelicCollectionManager(state);

    expect(manager.setFavorite("spino")).toBe(false);
    expect(manager.setParty(["anky", "rex", "spino"])).toEqual({ ok: false, reason: "not-owned", relicId: "spino" });
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

    expect(manager.setParty(["rex", "dodo", "anky"])).toEqual({ ok: true });
    expect(manager.setParty(["rex", "rex", "anky"])).toEqual({ ok: false, reason: "duplicate" });
    expect(state.party).toEqual(["rex", "dodo", "anky"]);
  });

  it("파티 인원 부족과 미보유를 서로 다른 실패 사유로 돌려준다", () => {
    const manager = new RelicCollectionManager(makeSession());

    // UI가 같은 false를 추측하지 않고 각 원인에 맞는 안내를 표시할 수 있어야 한다.
    expect(manager.setParty(["anky", "rex"])).toEqual({ ok: false, reason: "wrong-size" });
    expect(manager.setParty(["anky", "rex", "quetzal"])).toEqual({ ok: false, reason: "not-owned", relicId: "quetzal" });
  });
});
