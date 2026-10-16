import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameCallError, StateConflictError, handleGameCall, type StateStore, type StoredState } from "../../src/server/gameHandler";
import { SERVER_GAME_METHODS } from "../../src/server/gameMethods";

function memoryStore() {
  const saves = new Map<string, StoredState>();
  const receipts = new Map<string, unknown>();
  let commits = 0;
  const store: StateStore = {
    async load(id) { return saves.get(id) ?? null; },
    async findReceipt(id, req) { return receipts.get(`${id}:${req}`); },
    async commit(i) {
      const cur = saves.get(i.playerId);
      if ((cur?.revision ?? null) !== i.expectedRevision) throw new StateConflictError();
      const revision = String(Number(cur?.revision ?? 0) + 1);
      saves.set(i.playerId, { revision, data: i.data });
      commits += 1;
      if (i.requestId) receipts.set(`${i.playerId}:${i.requestId}`, { ...(i.response as object), revision });
      return { revision };
    },
  };
  return { store, saves, commits: () => commits };
}
const P = "00000000-0000-0000-0000-000000000001";
const fixed = { now: () => new Date("2026-10-16T00:00:00Z"), random: () => 0.5 };

describe("서버 호출 처리기", () => {
  it("메서드 목록이 GameApi 인터페이스와 같다", () => {
    const src = readFileSync("src/api/contracts.ts", "utf8");
    const body = src.slice(src.indexOf("export interface GameApi"));
    const names = [...body.slice(0, body.indexOf("\n}\n")).matchAll(/^  ([a-zA-Z]+)\(/gm)].map((m) => m[1]);
    names.push("getAsyncArenaServerState");
    expect([...SERVER_GAME_METHODS].sort()).toEqual([...new Set(names)].sort());
    for (const name of SERVER_GAME_METHODS) expect(typeof (FakeServer.prototype as unknown as Record<string, unknown>)[name]).toBe("function");
  });

  it("처음 호출하면 기본 상태를 만들어 저장한다", async () => {
    const m = memoryStore();
    const out = await handleGameCall(P, { method: "getInventory" }, { store: m.store, ...fixed });
    expect(out.revision).toBe("1");
    expect(m.saves.get(P)?.revision).toBe("1");
  });

  it("규칙이 거절하면 상태를 바꾸지 않고 사유를 돌려준다", async () => {
    const m = memoryStore();
    await handleGameCall(P, { method: "getInventory" }, { store: m.store, ...fixed });
    const before = JSON.stringify(m.saves.get(P));
    const err = await handleGameCall(P, { method: "rechargeStamina", args: [{ method: "gems", requestId: "req-aaaaaaaa" }] }, { store: m.store, ...fixed }).catch((e) => e);
    expect(err).toBeInstanceOf(GameCallError);
    expect(JSON.stringify(m.saves.get(P))).toBe(before);
  });

  it("목록에 없는 메서드와 잘못된 요청 키를 거절한다", () => {
    const m = memoryStore();
    expect(() => handleGameCall(P, { method: "constructor" }, { store: m.store })).toThrow(GameCallError);
    expect(() => handleGameCall(P, { method: "getInventory", requestId: "x" }, { store: m.store })).toThrow(GameCallError);
  });

  it("같은 requestId 재전송은 저장된 응답을 그대로 돌려준다", async () => {
    const m = memoryStore();
    const req = { method: "markAttendanceAutoShown", requestId: "call-0001" };
    const first = await handleGameCall(P, req, { store: m.store, ...fixed });
    const again = await handleGameCall(P, req, { store: m.store, ...fixed });
    expect(again.state).toEqual(first.state);
    expect(again.revision).toBe(first.revision);
    expect(m.commits()).toBe(1);
  });

  it("동시 충돌은 다시 읽고 재시도한다", async () => {
    const m = memoryStore();
    await handleGameCall(P, { method: "getInventory" }, { store: m.store, ...fixed });
    let once = true;
    const flaky: StateStore = { ...m.store, async commit(i) {
      if (once) { once = false; throw new StateConflictError(); }
      return m.store.commit(i);
    } };
    const out = await handleGameCall(P, { method: "markAttendanceAutoShown" }, { store: flaky, ...fixed });
    expect(out.ok).toBe(true);
  });
});
