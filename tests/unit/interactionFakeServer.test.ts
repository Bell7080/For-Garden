import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";

/** FakeServer도 시작 시각 소유와 완료 수령 멱등성을 실제 API 호출로 고정한다. */
describe("FakeServer interaction API", () => {
  it("종료 전 수령을 막고 같은 requestId를 두 번 지급하지 않는다", async () => {
    let now = new Date("2026-09-03T00:00:00.000Z"); const state = createDefaultSession(); const server = new FakeServer(state, { latencyMs: 0, random: () => 0, now: () => now });
    const started = await server.startInteractionDispatch({ cityId: "central-garden", party: ["anky"] }); expect(started.dispatch?.startedAt).toBe(now.toISOString()); await expect(server.claimInteractionDispatch({ dispatchId: started.dispatch!.dispatchId, requestId: "claim-1" })).rejects.toThrow();
    now = new Date(started.dispatch!.completesAt); const before = state.wallet.gold; const first = await server.claimInteractionDispatch({ dispatchId: started.dispatch!.dispatchId, requestId: "claim-1" }); const second = await server.claimInteractionDispatch({ dispatchId: started.dispatch!.dispatchId, requestId: "claim-1" }); expect(state.wallet.gold - before).toBe(first.granted.amount); expect(second).toEqual(first);
  });
});
