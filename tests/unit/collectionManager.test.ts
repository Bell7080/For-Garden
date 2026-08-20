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
    wallet: { fossil: 0, amber: 0 },
    relicProgress: {},
    ownedHeartGemIds: [],
  };
}

describe("RelicCollectionManager", () => {
  it("중복 획득과 최초 획득을 구분한다", () => {
    const manager = new RelicCollectionManager(makeSession());

    expect(manager.acquire("anky")).toBe(false);
    expect(manager.acquire("spino")).toBe(true);
    expect(manager.owns("spino")).toBe(true);
  });

  it("여러 발굴 결과의 신규와 중복을 순서대로 분리한다", () => {
    const manager = new RelicCollectionManager(makeSession());

    expect(manager.applyAcquisitions(["anky", "spino", "spino"])).toEqual({
      fresh: ["spino"],
      duplicates: ["anky", "spino"],
    });
  });

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
