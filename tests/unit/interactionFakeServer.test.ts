import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";

/** FakeServer도 시작 시각 소유와 완료 수령 멱등성을 실제 API 호출로 고정한다. */
describe("FakeServer interaction API", () => {
  it("종료 전 수령을 막고 같은 requestId를 두 번 지급하지 않는다", async () => {
    let now = new Date("2026-09-03T00:00:00.000Z"); const state = createDefaultSession(); const server = new FakeServer(state, { latencyMs: 0, random: () => 0, now: () => now });
    const started = await server.startInteractionDispatch({ cityId: "doppel-parlor", party: ["anky"] });
    const dispatch = started.dispatches[0]!; expect(dispatch.startedAt).toBe(now.toISOString());
    await expect(server.claimInteractionDispatch({ dispatchId: dispatch.dispatchId, requestId: "claim-1" })).rejects.toThrow();
    now = new Date(dispatch.completesAt); const before = state.wallet.gold;
    const first = await server.claimInteractionDispatch({ dispatchId: dispatch.dispatchId, requestId: "claim-1" });
    const second = await server.claimInteractionDispatch({ dispatchId: dispatch.dispatchId, requestId: "claim-1" });
    expect(state.wallet.gold - before).toBe(first.granted.find(({ currency }) => currency === "gold")?.amount ?? 0); expect(second).toEqual(first);
  });

  it("여러 도시에 함께 나가되 같은 도시와 같은 렐릭은 두 번 나가지 않는다", async () => {
    const now = new Date("2026-09-03T00:00:00.000Z"); const state = createDefaultSession();
    // 두 도시가 모두 열리도록 레벨을 올려 둔다. 개방은 플레이어 레벨이 정한다.
    state.playerResearch = { ...state.playerResearch, level: 9 };
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0, now: () => now });
    await server.startInteractionDispatch({ cityId: "doppel-parlor", party: ["anky"] });
    const both = await server.startInteractionDispatch({ cityId: "night-ward", party: ["rex"] });
    expect(both.dispatches).toHaveLength(2);
    await expect(server.startInteractionDispatch({ cityId: "doppel-parlor", party: ["spino"] })).rejects.toThrow();
    await expect(server.startInteractionDispatch({ cityId: "abyss-port", party: ["anky"] })).rejects.toThrow();
  });

  it("돌아올 것은 출발할 때 표의 모든 줄에서 굴리고, 수령하면 그 목록 그대로 들어온다", async () => {
    let now = new Date("2026-09-03T00:00:00.000Z"); const state = createDefaultSession();
    // 가장 높은 쪽으로 굴린다 — 「0~n」인 귀한 줄도 비지 않는다.
    const server = new FakeServer(state, { latencyMs: 0, random: () => 0.999, now: () => now });
    const [dispatch] = (await server.startInteractionDispatch({ cityId: "doppel-parlor", party: ["anky", "rex", "spino"] })).dispatches;
    expect(dispatch.rewards.map(({ currency }) => currency)).toEqual(["gold", "cheesecake", "rawStone"]);
    // 그 도시의 교류 파견 임무도 함께 센다.
    expect(state.missions.progress["weekly-dispatch"]).toBe(1);
    now = new Date(dispatch.completesAt);
    const claim = await server.claimInteractionDispatch({ dispatchId: dispatch.dispatchId, requestId: "all-lines" });
    expect(claim.granted).toEqual(dispatch.rewards);
  });
});
