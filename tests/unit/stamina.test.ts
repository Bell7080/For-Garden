import { describe, expect, it } from "vitest";
import { ABSOLUTE_STAMINA_MAX, settleStamina, staminaMaxForResearchLevel, staminaTiming } from "../../src/core/stamina";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";

describe("stamina rules", () => {
  it("calculates research-level maximums and the absolute cap", () => {
    // 레벨 증가와 비정상/극단 입력이 같은 순수 공식으로 정규화되는지 고정한다.
    expect(staminaMaxForResearchLevel(1)).toBe(122);
    expect(staminaMaxForResearchLevel(20)).toBe(160);
    expect(staminaMaxForResearchLevel(999)).toBe(ABSOLUTE_STAMINA_MAX);
  });

  it("settles offline time only at completed five-minute boundaries", () => {
    const start = "2026-09-01T00:00:00.000Z";
    expect(settleStamina(10, 122, start, new Date("2026-09-01T00:04:59.999Z"))).toMatchObject({ amount: 10, recovered: 0, updatedAt: start });
    expect(settleStamina(10, 122, start, new Date("2026-09-01T00:15:00.000Z"))).toMatchObject({ amount: 13, recovered: 3, updatedAt: "2026-09-01T00:15:00.000Z" });
  });

  it("stops at the dynamic maximum and reports no further schedule", () => {
    const result = settleStamina(121, 122, "2026-08-31T00:00:00.000Z", new Date("2026-09-01T00:00:00.000Z"));
    expect(result).toMatchObject({ amount: 122, recovered: 1, updatedAt: "2026-09-01T00:00:00.000Z" });
    expect(staminaTiming(result.amount, 122, result.updatedAt)).toEqual({ nextRecoveryAt: null, fullAt: null });
  });

  it("tonic returns applied and overflow amounts against the research maximum", async () => {
    const state = createDefaultSession();
    state.wallet.stamina = 120; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    state.itemInventory = [{ itemId: "stamina-tonic", quantity: 1 }];
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:01:00.000Z") });
    const response = await api.useConsumable({ itemId: "stamina-tonic", quantity: 1 });
    // 기본 레벨 1의 동적 최대치 122까지 2만 적용하고 나머지 28은 명시적으로 돌려준다.
    expect(response).toMatchObject({ appliedAmount: 2, overflowAmount: 28, stamina: { current: 122, maximum: 122 } });
  });

  it("keeps current stamina on level-up and fills the newly opened space naturally", () => {
    // 레벨업은 현재량을 직접 지급하지 않고 최대치만 넓힌다.
    expect(settleStamina(122, staminaMaxForResearchLevel(2), "2026-09-01T00:00:00.000Z", new Date("2026-09-01T00:10:00.000Z"))).toMatchObject({ amount: 124, recovered: 2 });
  });
});

describe("stamina admission", () => {
  it("charges a normal stage only once for the same request id", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 20; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    const request = { stageId: "1-1", requestId: "admission-1" };
    const first = await api.enterStage(request); const retried = await api.enterStage(request);
    expect(first.staminaSpent).toBe(6); expect(retried.wallet.stamina).toBe(14); expect(state.wallet.stamina).toBe(14);
    expect(retried.refundPolicy).toBe("no-refund-after-admission");
  });
});
