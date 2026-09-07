import { describe, expect, it } from "vitest";
import { ABSOLUTE_STAMINA_MAX, settleStamina, staminaMaxForResearchLevel, staminaTiming } from "../../src/core/stamina";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { TIME_ACCRUAL_FIXTURES } from "../fixtures/timeAccrual";
import { CONTENT_STAMINA_COSTS } from "../../src/data/contentCosts";
import { GameApiError } from "../../src/api/contracts";
import { partyEntryErrorView } from "../../src/scenes/partyEntryError";

describe("stamina rules", () => {
  it("shares timezone, regression, long-offline, and boundary clock fixtures with excavation", () => {
    const fixture = TIME_ACCRUAL_FIXTURES;
    // 시간대 표기가 달라도 한 시간은 12틱이며, 장기 오프라인은 최대치까지만 회복한다.
    expect(settleStamina(0, 120, fixture.timezoneChange.lastSettledAt, new Date(fixture.timezoneChange.serverNow))).toMatchObject({ amount: 12, recovered: 12 });
    expect(settleStamina(0, 120, fixture.longOffline.lastSettledAt, new Date(fixture.longOffline.serverNow))).toMatchObject({ amount: 120, recovered: 120 });
    // 역행은 기존 기준점을 유지하고 정확한 1시간 경계는 빠짐없이 12틱으로 계산한다.
    expect(settleStamina(0, 120, fixture.clockRegression.lastSettledAt, new Date(fixture.clockRegression.serverNow))).toMatchObject({ amount: 0, recovered: 0, updatedAt: fixture.clockRegression.lastSettledAt });
    expect(settleStamina(0, 120, fixture.expiryBoundary.lastSettledAt, new Date(fixture.expiryBoundary.serverNow))).toMatchObject({ amount: 12, recovered: 12 });
  });

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
  it("keeps stamina at admission and charges only a victory once for the same request id", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 20; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    const request = { stageId: "1-1", requestId: "admission-1" };
    const first = await api.enterStage(request); const retried = await api.enterStage(request);
    expect(first.staminaCost).toBe(6); expect(retried.wallet.stamina).toBe(20); expect(state.wallet.stamina).toBe(20);
    expect(retried.chargePolicy).toBe("victory-only");
    await api.completeStage("1-1", true);
    expect(state.wallet.stamina).toBe(14);
  });

  it("returns INSUFFICIENT_STAMINA without changing a balance below the admission cost", async () => {
    const state = createDefaultSession();
    state.wallet.stamina = CONTENT_STAMINA_COSTS.normalStage - 1;
    state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    await expect(api.enterStage({ stageId: "1-1", requestId: "insufficient" })).rejects.toMatchObject({ code: "INSUFFICIENT_STAMINA" });
    // 거절은 예약이나 차감보다 먼저 끝나므로 원래 잔량을 그대로 보존한다.
    expect(state.wallet.stamina).toBe(CONTENT_STAMINA_COSTS.normalStage - 1);
  });

  it("does not charge stamina after defeat and charges the next victorious admission", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 20; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    await api.enterStage({ stageId: "1-1", requestId: "defeat" });
    await api.completeStage("1-1", false);
    expect(state.wallet.stamina).toBe(20);
    await api.enterStage({ stageId: "1-1", requestId: "victory" });
    await api.completeStage("1-1", true);
    expect(state.wallet.stamina).toBe(14);
  });

  it("maps insufficient stamina to recharge guidance instead of a party-save failure", () => {
    const view = partyEntryErrorView(new GameApiError("INSUFFICIENT_STAMINA", "server detail"));
    // 씬에 Phaser를 띄우지 않고도 두 실패 경계의 문구가 다시 섞이지 않는지 고정한다.
    expect(view).toMatchObject({ openStaminaPopup: true });
    expect(view.message).toContain("스테미나");
    expect(view.message).not.toContain("파티 저장");
  });
});
