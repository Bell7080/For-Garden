import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import type { Session } from "../../src/state/session";

/** 각 테스트가 독립적으로 쓸 서버 저장소 역할의 세션을 만든다. */
function makeSession(fossil = 1000): Session {
  return {
    selectedStageId: null,
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    pullCountSinceHighestRarity: { fossil: 0, amber: 0 },
    wallet: { fossil, amber: 10, dnaFragments: 0 },
    relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: id === "anky" ? 2 : 1, levelTitle: id === "anky" ? "발아체" : "복원체", dnaMastery: id === "anky" ? 1 : 0, heartGemSlots: id === "anky" ? ["vital-seed", null, null] : [null, null, null] }])),
    ownedHeartGemIds: ["vital-seed"],
    dailyContent: { date: "", completedIds: [], claimedRewardIds: [] },
  };
}

describe("FakeServer", () => {
  it("서버 안에서 비용과 결과를 함께 확정한다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0 });

    const response = await server.pullRelics({ bannerId: "fossil", count: 1 });

    expect(response.wallet.fossil).toBe(900);
    expect(response.results).toEqual([{ relicId: "rex", kind: "mastery", dnaBefore: 0, dnaAfter: 1, overflowFragments: 0 }]);
    expect(response.duplicateRelicIds).toEqual(["rex"]);
    expect(state.wallet.fossil).toBe(900);
    expect(state.pullCountSinceHighestRarity.fossil).toBe(0);
  });

  it("최초 획득의 성장 레코드를 같은 처리에서 만들고 같은 10연 중복을 누적한다", async () => {
    const state = makeSession();
    // fossil 배너에서 RNG 0은 rex만 뽑으므로 미보유로 만들어 순차 획득을 검증한다.
    state.owned.delete("rex");
    delete state.relicProgress.rex;
    const response = await new FakeServer(state, { latencyMs: 0, random: () => 0 }).pullRelics({ bannerId: "fossil", count: 10 });
    expect(response.results[0].kind).toBe("new");
    expect(response.results[1]).toMatchObject({ kind: "mastery", dnaBefore: 0, dnaAfter: 1 });
    expect(state.relicProgress.rex).toMatchObject({ level: 1, dnaMastery: 5 });
    expect(state.wallet.dnaFragments).toBe(4);
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
    const server = new FakeServer(state, { latencyMs: 0 });
    const snapshot = await server.getPlayerState();

    snapshot.wallet.fossil = 0;
    snapshot.ownedRelicIds.push("spino");
    snapshot.relicProgress.anky.heartGemSlots[0] = null;
    snapshot.ownedHeartGemIds.length = 0;

    expect(state.wallet.fossil).toBe(1000);
    expect(state.owned.has("spino")).toBe(false);
    expect(state.relicProgress.anky.heartGemSlots[0]).toBe("vital-seed");
    expect(state.ownedHeartGemIds).toEqual(["vital-seed"]);
  });
});
