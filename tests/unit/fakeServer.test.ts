import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import type { Session } from "../../src/state/session";

/** 각 테스트가 독립적으로 쓸 서버 저장소 역할의 세션을 만든다. */
function makeSession(fossil = 1000): Session {
  return {
    completedStoryIds: new Set(),
    selectedStageId: null,
    party: ["anky", "rex", "dodo"],
    cleared: new Set(),
    owned: new Set(["anky", "rex", "dodo"]),
    favorite: "anky",
    pullCountSinceHighestRarity: { fossil: 0, amber: 0 },
    wallet: { fossil, amber: 10, dnaFragments: 0, weeds: 0 },
    relicProgress: Object.fromEntries(["anky", "rex", "dodo"].map((id) => [id, { level: id === "anky" ? 2 : 1, levelTitle: id === "anky" ? "발아체" : "복원체", dnaMastery: id === "anky" ? 1 : 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: id === "anky" ? ["vital-seed", null, null] : [null, null, null] }])),
    ownedHeartGemIds: ["vital-seed"],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
  };
}

describe("FakeServer", () => {
  it("레벨업 재화를 검사·차감하고 새 성장을 서버 상태에 반영한다", async () => {
    const state = makeSession(); state.wallet.weeds = 20;
    const server = new FakeServer(state, { latencyMs: 0 });
    const response = await server.levelUpRelic("anky");
    expect(response).toMatchObject({ relicId: "anky", cost: 20, wallet: { weeds: 0 } });
    expect(state.relicProgress.anky.level).toBe(3);
    await expect(server.levelUpRelic("anky")).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
  });

  it("메인 스테이지의 최초와 반복 보상을 데이터대로 구분한다", async () => {
    const state = makeSession(); const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.completeStage("1-1")).resolves.toMatchObject({ firstClear: true, weedsEarned: 30 });
    await expect(server.completeStage("1-1")).resolves.toMatchObject({ firstClear: false, weedsEarned: 10 });
    expect(state.wallet.weeds).toBe(40);
  });

  it("승리만 편성 렐릭 유대를 올리고 패배에는 전투 보상을 지급하지 않는다", async () => {
    const state = makeSession(); const server = new FakeServer(state, { latencyMs: 0 });
    await server.completeStage("1-1", false);
    expect([state.wallet.weeds, state.relicProgress.anky.bondXp]).toEqual([0, 0]);
    await server.completeStage("1-1", true);
    expect(state.relicProgress.anky.bondXp).toBe(12);
    expect(state.relicProgress.rex.bondXp).toBe(12);
    expect(state.relicProgress.dodo.bondXp).toBe(12);
  });

  it("로비 상호작용은 서버 UTC 날짜마다 첫 터치만 지급한다", async () => {
    const state = makeSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T23:59:00Z") });
    await expect(server.interactInLobby("anky")).resolves.toMatchObject({ bondXpEarned: 5 });
    await expect(server.interactInLobby("anky")).resolves.toMatchObject({ bondXpEarned: 0 });
  });

  it("일일 복원은 UTC 하루 3회이고 다음 UTC 날짜에만 횟수를 초기화한다", async () => {
    const state = makeSession(); let now = new Date("2026-08-20T23:59:00Z");
    const server = new FakeServer(state, { latencyMs: 0, now: () => now });
    for (let index = 0; index < 3; index += 1) await server.enterDailyRestoration();
    await expect(server.enterDailyRestoration()).rejects.toMatchObject({ code: "DAILY_ENTRY_LIMIT" });
    now = new Date("2026-08-21T00:00:00Z");
    await expect(server.enterDailyRestoration()).resolves.toMatchObject({ entriesRemaining: 2, weedsEarned: 40 });
    expect(state.dailyContent).toMatchObject({ date: "2026-08-21", restorationEntries: 1 });
  });
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
    expect(state.relicProgress.rex).toMatchObject({ bondLevel: 1, bondXp: 20 });
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
