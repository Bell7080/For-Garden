import { afterEach, describe, expect, it, vi } from "vitest";
import { handleGameCall, MAX_CONCURRENT_GAME_CALLS, StateConflictError, type StateStore, type StoredState } from "../../src/server/gameHandler";
import { createDefaultSession } from "../../src/state/session";
import { saveManager } from "../../src/state/SaveManager";
import { setLiveSchedule } from "../../src/core/liveSchedule";

const fixed = { now: () => new Date("2026-11-24T00:00:00Z"), random: () => 0.5 };
function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
function memoryStore() {
  const saves = new Map<string, StoredState>();
  const store: StateStore = {
    async load(id) { return saves.get(id) ?? null; },
    async findReceipt() { return undefined; },
    async commit(input) {
      const previous = saves.get(input.playerId);
      if ((previous?.revision ?? null) !== input.expectedRevision) throw new StateConflictError();
      const revision = String(Number(previous?.revision ?? 0) + 1);
      saves.set(input.playerId, { revision, data: input.data });
      return { revision };
    },
  };
  return { store, saves };
}
afterEach(() => { setLiveSchedule([]); });

describe("유저 간 DB 대기 분리", () => {
  it("알림의 길드 조회를 기다리는 중에도 다른 계정은 게임 규칙을 실행한다", async () => {
    const { store, saves } = memoryStore();
    const started = barrier(), db = barrier();
    const state = createDefaultSession();
    state.playerResearch.level = 20;
    saves.set("guild-slow", { revision: "1", data: saveManager.exportData(state) });
    store.guildReadContext = async () => {
      started.release();
      await db.promise;
      return { level: 1, attendanceReady: true };
    };
    const notification = handleGameCall("guild-slow", { method: "getNotificationSignals" }, { store, ...fixed });
    let completed = false;
    const other = started.promise.then(() => handleGameCall("other-guild-read", { method: "getPlayerState" }, { store, ...fixed }))
      .then(() => { completed = true; });
    try { await vi.waitFor(() => expect(completed).toBe(true)); }
    finally { db.release(); await Promise.allSettled([notification, other]); }
    expect((await notification).result).toMatchObject({ guildAttendanceReady: true });
  });

  it("4명의 상태 조회는 함께 진행하고 계정별 재화는 섞이지 않는다", async () => {
    const { store, saves } = memoryStore();
    const gate = barrier();
    const entered: string[] = [];
    for (let i = 0; i < 4; i++) {
      const state = createDefaultSession();
      state.wallet.gold = 1000 + i;
      saves.set(`parallel-${i}`, { revision: "1", data: saveManager.exportData(state) });
    }
    const originalLoad = store.load;
    store.load = async id => { entered.push(id); await gate.promise; return originalLoad(id); };
    const calls = Array.from({ length: 4 }, (_, i) => handleGameCall(`parallel-${i}`, { method: "getPlayerState" }, { store, ...fixed }));
    try { await vi.waitFor(() => expect(entered).toHaveLength(4)); }
    finally { gate.release(); await Promise.allSettled(calls); }
    const results = await Promise.all(calls);
    expect(results.map(result => saveManager.parse(result.state).wallet.gold)).toEqual([1000, 1001, 1002, 1003]);
  });

  it("한 계정의 저장이 느려도 다른 계정은 완료하고 같은 계정의 다음 요청은 기다린다", async () => {
    const { store } = memoryStore();
    const committing = barrier(), gate = barrier();
    const loaded: string[] = [];
    const originalLoad = store.load, originalCommit = store.commit;
    store.load = async id => { loaded.push(id); return originalLoad(id); };
    store.commit = async input => {
      if (input.playerId === "slow-save") { committing.release(); await gate.promise; }
      return originalCommit(input);
    };
    const first = handleGameCall("slow-save", { method: "getPlayerState" }, { store, ...fixed });
    await committing.promise;
    const second = handleGameCall("slow-save", { method: "getPlayerState" }, { store, ...fixed });
    let otherFinished = false;
    const other = handleGameCall("independent", { method: "getPlayerState" }, { store, ...fixed }).then(result => { otherFinished = true; return result; });
    try {
      await vi.waitFor(() => expect(otherFinished).toBe(true));
      expect(loaded.filter(id => id === "slow-save")).toHaveLength(1);
    } finally { gate.release(); await Promise.allSettled([first, second, other]); }
    expect((await second).revision).toBe((await first).revision);
    expect(loaded.filter(id => id === "slow-save")).toHaveLength(2);
  });

  it("동시 DB 작업은 상한을 지키고 슬롯 대기 중 만료된 요청은 조회하지 않는다", async () => {
    const { store } = memoryStore();
    const gate = barrier();
    const entered: string[] = [];
    const originalLoad = store.load;
    store.load = async id => { entered.push(id); await gate.promise; return originalLoad(id); };
    const active = Array.from({ length: MAX_CONCURRENT_GAME_CALLS }, (_, i) => handleGameCall(`bounded-${i}`, { method: "getPlayerState" }, { store, ...fixed }));
    const controller = new AbortController();
    let expired: Promise<unknown> | undefined;
    try {
      await vi.waitFor(() => expect(entered).toHaveLength(MAX_CONCURRENT_GAME_CALLS));
      expired = expect(handleGameCall("expired-slot", { method: "getPlayerState" }, { store, ...fixed, signal: controller.signal }))
        .rejects.toMatchObject({ code: "request_timeout" });
      controller.abort();
    } finally { gate.release(); await Promise.allSettled(active); }
    await expired;
    expect(entered).toHaveLength(MAX_CONCURRENT_GAME_CALLS);
    await expect(handleGameCall("after-slot", { method: "getPlayerState" }, { store, ...fixed })).resolves.toMatchObject({ ok: true });
  });

  it("서로 다른 운영 정의를 읽은 요청도 규칙 계산 중 정의가 섞이지 않는다", async () => {
    const { store } = memoryStore();
    const closed: StateStore = { ...store, liveSchedule: async () => [{ kind: "banner", id: "amber", startsAt: null, endsAt: null, enabled: false }] };
    const open: StateStore = { ...store, liveSchedule: async () => [] };
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) =>
      handleGameCall(`schedule-${i}`, { method: "getProducts", args: ["mileage"] }, { store: i % 2 ? open : closed, ...fixed, now: () => new Date("2026-10-16T00:00:00Z") })));
    expect(results.map(result => (result.result as { products: { id: string }[] }).products.some(product => product.id === "mileage-pickup-amber-dian")))
      .toEqual([false, true, false, true]);
  });

  it("실패한 계정 요청 뒤에도 다음 요청을 실행한다", async () => {
    const { store } = memoryStore();
    const originalLoad = store.load;
    let first = true;
    store.load = async id => {
      if (first) { first = false; throw new Error("db_unavailable"); }
      return originalLoad(id);
    };
    const failed = handleGameCall("recovering", { method: "getPlayerState" }, { store, ...fixed });
    const next = handleGameCall("recovering", { method: "getPlayerState" }, { store, ...fixed });
    await expect(failed).rejects.toThrow("db_unavailable");
    await expect(next).resolves.toMatchObject({ ok: true });
  });
});
