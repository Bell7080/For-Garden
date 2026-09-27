import { describe, expect, it } from "vitest";
import { ABSOLUTE_STAMINA_MAX, settleStamina, staminaMaxForResearchLevel, staminaTiming } from "../../src/core/stamina";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { TIME_ACCRUAL_FIXTURES } from "../fixtures/timeAccrual";
import { CONTENT_STAMINA_COSTS } from "../../src/data/contentCosts";
import { GameApiError } from "../../src/api/contracts";
import { partyEntryErrorView } from "../../src/scenes/partyEntryError";
import { PLAYER_LEVEL_UP_REWARD } from "../../src/core/playerLevel";

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
    // 기본 레벨 1의 동적 최대치 122까지 2만 적용하고 나머지 58은 명시적으로 돌려준다.
    expect(response).toMatchObject({ appliedAmount: 2, overflowAmount: 58, stamina: { current: 122, maximum: 122 } });
  });

  it("keeps current stamina on level-up and fills the newly opened space naturally", () => {
    // 자연 회복 계산은 현재량을 직접 올리지 않고 최대치만 넓힌다. 레벨업 충전은 서버의 `spendStamina`가 맡는다.
    expect(settleStamina(122, staminaMaxForResearchLevel(2), "2026-09-01T00:00:00.000Z", new Date("2026-09-01T00:10:00.000Z"))).toMatchObject({ amount: 124, recovered: 2 });
  });
});

describe("stamina admission", () => {
  it("admission only checks stamina; the same request id returns the first receipt", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 20; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    const request = { stageId: "1-1", requestId: "admission-1" };
    const first = await api.enterStage(request); const retried = await api.enterStage(request);
    // 이긴 판만 스테미나를 쓴다 — 입장은 값을 확인하고 영수증을 걸어 둘 뿐이다.
    expect(first.staminaCost).toBe(6); expect(retried).toEqual(first); expect(state.wallet.stamina).toBe(20);
    expect(retried.refundPolicy).toBe("charged-on-victory");
  });

  it("preserves stamina when victory persistence fails and charges once on a successful retry", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 20; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    let shouldFail = false;
    // 저장 어댑터의 승리 커밋만 실패시켜 실제 저장소 예외 뒤 같은 확정 재시도를 재현한다.
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z"), persistSession: () => { if (shouldFail) throw new Error("storage unavailable"); } });
    await api.enterStage({ stageId: "1-1", requestId: "persistence-retry" });

    /*
     * **저장 실패는 공용 API 오류로 감싸여 나온다.**
     *
     * 화면이 여러 곳에서 `error.message`를 그대로 그리므로 저장소의 원문이 그대로 나가면
     * 플레이어가 영어 내부 메시지를 읽는다. 원인은 `cause`에 남으므로 여기서 함께 확인한다.
     */
    shouldFail = true;
    const failure = await api.completeStage("1-1", true).then(() => undefined, (error: unknown) => error);
    expect(failure).toBeInstanceOf(GameApiError);
    expect((failure as GameApiError).code).toBe("PERSISTENCE_FAILED");
    expect(((failure as GameApiError).cause as Error).message).toBe("storage unavailable");
    // persist 이전에는 복제 지갑만 바뀌므로 실패한 커밋이 공유 메모리 잔액을 오염시키지 않는다.
    expect(state.wallet.stamina).toBe(20);

    shouldFail = false;
    const succeeded = await api.completeStage("1-1", true);
    expect(succeeded.staminaSpent).toBe(6); expect(state.wallet.stamina).toBe(14);
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

  it("spends nothing on defeat or an abandoned run and charges only the won run", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 20; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    state.playerResearch = { level: 1, experience: 0, experienceToNext: 50 };
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    await api.enterStage({ stageId: "1-1", requestId: "defeat" });
    const lost = await api.completeStage("1-1", false);
    // 진 판은 아무것도 빠지지 않고 경험치도 오르지 않는다 — 그 몫이 돌려준 몫이다.
    expect(state.wallet.stamina).toBe(20);
    expect(lost).toMatchObject({ staminaSpent: 0, staminaRefunded: 6 });
    expect(lost.playerExp).toBeUndefined();
    expect(state.playerResearch.experience).toBe(0);
    // 결과 확정 없이 끊긴 판도 빠진 것이 없다.
    await api.enterStage({ stageId: "1-2", requestId: "abandoned" });
    expect(state.wallet.stamina).toBe(20);
    await api.enterStage({ stageId: "1-1", requestId: "victory" });
    const won = await api.completeStage("1-1", true);
    expect(state.wallet.stamina).toBe(14);
    expect(won).toMatchObject({ staminaSpent: 6, staminaRefunded: 0 });
    expect(won.playerExp?.granted).toBe(6);
  });

  it("maps insufficient stamina to recharge guidance instead of a party-save failure", () => {
    const view = partyEntryErrorView(new GameApiError("INSUFFICIENT_STAMINA", "server detail"));
    // 씬에 Phaser를 띄우지 않고도 두 실패 경계의 문구가 다시 섞이지 않는지 고정한다.
    expect(view).toMatchObject({ openStaminaPopup: true });
    expect(view.message).toContain("스테미나");
    expect(view.message).not.toContain("파티 저장");
  });
});

describe("연구원 경험치", () => {
  it("쓴 스테미나만큼 경험치가 오르고, 레벨이 오르면 스테미나 대신 에너지 드링크+를 한 병 준다", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 60; state.staminaUpdatedAt = "2026-09-01T00:00:00.000Z";
    state.playerResearch = { level: 1, experience: 46, experienceToNext: 50 };
    state.itemInventory = state.itemInventory.filter(({ itemId }) => itemId !== PLAYER_LEVEL_UP_REWARD.itemId);
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-01T00:00:00.000Z") });
    await api.enterStage({ stageId: "1-1", requestId: "exp-1" });
    // 경험치는 입장이 아니라 **이긴 판의 결과 확정**에서 오른다(`charged-on-victory`).
    expect(state.playerResearch.level).toBe(1);
    const admission = await api.completeStage("1-1", true);
    expect(state.playerResearch.level).toBe(2);
    expect(state.playerResearch.experience).toBe(46 + CONTENT_STAMINA_COSTS.normalStage - 50);
    // 채우지 않는다 — 쓴 만큼만 줄고, 병이 가방에 들어간다.
    expect(state.wallet.stamina).toBe(60 - CONTENT_STAMINA_COSTS.normalStage);
    expect(state.itemInventory.find(({ itemId }) => itemId === PLAYER_LEVEL_UP_REWARD.itemId)?.quantity).toBe(1);
    expect(admission.playerExp).toMatchObject({ before: { level: 1, experience: 46 }, after: { level: 2 }, granted: CONTENT_STAMINA_COSTS.normalStage, levelsGained: 1, levelUpItems: [{ itemId: PLAYER_LEVEL_UP_REWARD.itemId, quantity: 1 }] });
    // 입장 영수증 하나는 한 번만 쓰인다 — 같은 판을 두 번 확정해도 경험치는 한 번이다.
    await api.completeStage("1-1", true);
    expect(state.playerResearch.experience).toBe(2);
  });
});
