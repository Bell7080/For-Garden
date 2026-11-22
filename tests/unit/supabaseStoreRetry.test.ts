import { describe, expect, it } from "vitest";
import { createSupabaseStore } from "../../src/server/supabaseStore";

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("서버 → DB 연결이 잠깐 멎었을 때", () => {
  it("응답 전에 끊긴 호출은 한 번 더 보낸다", async () => {
    let calls = 0;
    const store = createSupabaseStore({ url: "https://db.test", serviceKey: "k", fetchImpl: (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return okResponse({ uid: "U1", createdAt: "2026-11-22T00:00:00Z" });
    }) as typeof fetch });
    await expect(store.identity!("p1")).resolves.toEqual({ uid: "U1", createdAt: "2026-11-22T00:00:00Z" });
    expect(calls).toBe(2);
  });
  it("DB가 답한 실패와 두 번째 끊김은 다시 보내지 않는다", async () => {
    let calls = 0;
    const failing = createSupabaseStore({ url: "https://db.test", serviceKey: "k", fetchImpl: (async () => { calls += 1; throw new TypeError("fetch failed"); }) as typeof fetch });
    await expect(failing.identity!("p1")).rejects.toThrow("fetch failed");
    expect(calls).toBe(2);
    calls = 0;
    const answered = createSupabaseStore({ url: "https://db.test", serviceKey: "k", fetchImpl: (async () => { calls += 1; return new Response("{}", { status: 500 }); }) as typeof fetch });
    await expect(answered.identity!("p1")).rejects.toThrow("rpc_server_player_identity_500");
    expect(calls).toBe(1);
  });
  it("처리 마감이 지나면 다시 보내지 않는다", async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort();
    const store = createSupabaseStore({ url: "https://db.test", serviceKey: "k", signal: controller.signal, fetchImpl: (async () => { calls += 1; const e = new Error("aborted"); e.name = "TimeoutError"; throw e; }) as typeof fetch });
    await expect(store.identity!("p1")).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
