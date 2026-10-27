import { describe, expect, it, vi } from "vitest";
import { createRemoteGameApi } from "../../src/api/RemoteGameApi";
import { GameApiError } from "../../src/api/contracts";
import { FakeServer } from "../../src/api/FakeServer";
import { InventoryManager } from "../../src/managers/InventoryManager";
import { InteractionManager } from "../../src/managers/InteractionManager";
import { createDefaultSession, type Session } from "../../src/state/session";
import { saveManager } from "../../src/state/SaveManager";
import { handleGameCall, GameCallError, type StateStore } from "../../src/server/gameHandler";
import { partyEntryErrorView } from "../../src/scenes/partyEntryError";

const now = new Date("2026-10-20T00:00:00Z");
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function envelope(state: Session, revision: number, result: unknown) {
  return new Response(JSON.stringify({ ok: true, revision: String(revision), state: saveManager.exportData(state), result }));
}
function remote(state: Session, fetchImpl: typeof fetch) {
  return createRemoteGameApi({ getAccessToken: async () => "test", applyState: next => Object.assign(state, next), fetchImpl });
}
function memoryStore(initial: Session) {
  let current = { revision: "1", data: saveManager.exportData(initial) };
  const receipts = new Map<string, unknown>();
  const store: StateStore = {
    load: async () => structuredClone(current), findReceipt: async (_id, key) => structuredClone(receipts.get(key)),
    commit: async input => {
      expect(input.expectedRevision).toBe(current.revision);
      current = { revision: String(Number(current.revision) + 1), data: structuredClone(input.data) as typeof current.data };
      if (input.requestId) receipts.set(input.requestId, { ...input.response as object, revision: current.revision });
      return { revision: current.revision };
    },
  };
  return { store, state: () => saveManager.parse(current.data) };
}

describe("원격 진행·지급 복구", () => {
  it("확정 응답 2회 유실 뒤 창을 다시 열어 재시도해도 충전은 한 번이다", async () => {
    const state = createDefaultSession(); state.wallet.gems = 1000; state.wallet.stamina = 0; state.staminaUpdatedAt = now.toISOString();
    const memory = memoryStore(state);
    let lost = 0, firstRequest = "";
    const ids: string[] = [];
    const api = remote(state, async (_url, init) => {
      const req = JSON.parse(String(init?.body)); ids.push(req.requestId);
      const result = await handleGameCall("player", req, { store: memory.store, strict: true, now: () => now });
      firstRequest ||= req.requestId;
      if (lost++ < 2) throw Error("response lost after commit");
      return new Response(JSON.stringify(result));
    });
    await expect(new InventoryManager(state).rechargeStamina(api, "stamina-gems")).rejects.toThrow();
    const first = memory.state().wallet;
    await new InventoryManager(state).rechargeStamina(api, "stamina-gems");
    expect(new Set(ids)).toEqual(new Set([firstRequest]));
    expect(memory.state().wallet).toEqual(first);
    expect(state.wallet.gems).toBe(first.gems);
    expect(state.wallet.stamina).toBe(first.stamina);
  });

  it("새 서버 인스턴스에 다른 외부 요청 ID로 와도 같은 충전 명령은 다시 차감하지 않는다", async () => {
    const state = createDefaultSession(); state.wallet.gems = 1000; state.wallet.stamina = 0; state.staminaUpdatedAt = now.toISOString();
    const memory = memoryStore(state);
    const call = (requestId: string) => handleGameCall("player", { method: "rechargeStamina", args: [{ sourceId: "stamina-gems", requestId: "same-purchase-1" }], requestId }, { store: memory.store, strict: true, now: () => now });
    await call("outer-charge-1"); const first = memory.state().wallet;
    await call("outer-charge-2"); expect(memory.state().wallet).toEqual(first);
  });

  it("늦은 교류 조회는 다시 읽고 완료된 수령을 미수령으로 돌리지 않는다", async () => {
    const state = createDefaultSession(); const old = structuredClone(state);
    const dispatch = { dispatchId: "dispatch-1", cityId: "doppel-parlor", rewardSeed: "seed-1", rewards: [], party: ["torika"], startedAt: now.toISOString(), completesAt: new Date(now.getTime() + 3_600_000).toISOString(), claimed: false };
    const claimed = { ...dispatch, claimed: true };
    const latest = structuredClone(state); latest.interaction.slots = [claimed];
    const started = deferred(), release = deferred(); let reads = 0;
    const api = remote(state, async (_url, init) => {
      const { method } = JSON.parse(String(init?.body));
      if (method === "getInteractionDispatch" && reads++ === 0) { started.resolve(); await release.promise; return envelope(old, 5, { serverTime: now.toISOString(), dispatches: [dispatch] }); }
      return envelope(latest, 6, { serverTime: now.toISOString(), dispatches: [claimed], granted: [], wallet: latest.wallet });
    });
    const manager = new InteractionManager(api, state);
    const reading = manager.refresh(); await started.promise;
    await manager.claim(dispatch.dispatchId, "claim-1"); release.resolve();
    expect((await reading).dispatches[0].claimed).toBe(true);
    expect(state.interaction.slots[0]?.claimed).toBe(true);
  });

  it("소비 전 가방 조회가 소비한 병을 되살리지 않는다", async () => {
    const state = createDefaultSession(); state.itemInventory = [{ itemId: "stamina-tonic", quantity: 2 }]; state.wallet.stamina = 10; state.staminaUpdatedAt = now.toISOString();
    const serverState = structuredClone(state), server = new FakeServer(serverState, { latencyMs: 0, now: () => now, persistSession: () => undefined });
    const old = structuredClone(state), oldInventory = await server.getInventory();
    const started = deferred(), release = deferred(); let reads = 0;
    const api = remote(state, async (_url, init) => {
      const req = JSON.parse(String(init?.body));
      if (req.method === "getInventory" && reads++ === 0) { started.resolve(); await release.promise; return envelope(old, 5, oldInventory); }
      if (req.method === "getInventory") return envelope(serverState, 6, await server.getInventory());
      return envelope(serverState, 6, await server.useConsumable(req.args[0]));
    });
    const manager = new InventoryManager(state); const reading = manager.refresh(api); await started.promise;
    await manager.useConsumable(api, "stamina-tonic"); release.resolve(); await reading;
    expect(state.itemInventory[0].quantity).toBe(1); expect(state.wallet.stamina).toBe(70);
  });

  it("과거 쓰기 영수증도 더 최신 전체 상태를 다시 덮지 않는다", async () => {
    const state = createDefaultSession(); state.itemInventory = [{ itemId: "stamina-tonic", quantity: 2 }];
    const previous = structuredClone(state);
    const oldApi = new FakeServer(previous, { latencyMs: 0, now: () => now, persistSession: () => undefined });
    const result = await oldApi.useConsumable({ itemId: "stamina-tonic", quantity: 1 });
    const latest = structuredClone(previous); latest.wallet.gold = 12345;
    const started = deferred(), release = deferred();
    const api = remote(state, async (_url, init) => {
      const req = JSON.parse(String(init?.body));
      if (req.method === "useConsumable") { started.resolve(); await release.promise; return envelope(previous, 5, result); }
      return envelope(latest, 6, {});
    });
    const consuming = new InventoryManager(state).useConsumable(api, "stamina-tonic");
    await started.promise; await api.getPlayerState(); release.resolve(); await consuming;
    expect(state.wallet.gold).toBe(12345); expect(state.itemInventory[0].quantity).toBe(1);
  });

  it("충전·광고 지급은 같은 영수증의 가방만 반영하며 후속 조회 장애에 실패로 바뀌지 않는다", async () => {
    const state = createDefaultSession(); state.wallet.gems = 1000; state.wallet.stamina = 0;
    const api = new FakeServer(state, { latencyMs: 0, persistSession: () => undefined });
    const getInventory = vi.spyOn(api, "getInventory").mockRejectedValue(Error("offline after payment"));
    await new InventoryManager(state).rechargeStamina(api, "stamina-gems");
    expect(getInventory).not.toHaveBeenCalled(); expect(state.wallet.gems).toBeLessThan(1000);
  });

  it("원격 스테미나 부족도 공용 규칙 오류로 복원해 충전 창을 연다", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 0; state.staminaUpdatedAt = now.toISOString(); const memory = memoryStore(state);
    const api = remote(state, async (_url, init) => {
      try { return new Response(JSON.stringify(await handleGameCall("player", JSON.parse(String(init?.body)), { store: memory.store, strict: true, now: () => now }))); }
      catch (error) { const fail = error as GameCallError; return new Response(JSON.stringify({ ok: false, code: fail.code, domainCode: fail.domainCode, message: fail.message }), { status: fail.status }); }
    });
    try { await api.enterStage({ stageId: "1-1", requestId: "entry-no-stamina" }); expect.fail("must reject"); }
    catch (error) { expect(error).toBeInstanceOf(GameApiError); expect(partyEntryErrorView(error as GameApiError).openStaminaPopup).toBe(true); }
  });
});
