import { describe, expect, it, vi } from "vitest";
import { createRemoteGameApi, RemoteGameApiError } from "../../src/api/RemoteGameApi";
import { saveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

const state = saveManager.exportData(createDefaultSession());
const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result, state, revision: "2" }), { status: 200 });

describe("RemoteGameApi", () => {
  it("메서드를 서버로 보내고 돌려받은 상태를 반영한다", async () => {
    const fetchImpl = vi.fn(async () => ok({ hello: 1 }));
    const applied: unknown[] = [];
    const api = createRemoteGameApi({ getAccessToken: async () => "tok", applyState: (s) => applied.push(s), fetchImpl: fetchImpl as never, newRequestId: () => "rid-00000001" });
    expect(await api.useConsumable("a" as never)).toEqual({ hello: 1 });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ method: "useConsumable", requestId: "rid-00000001" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(applied).toHaveLength(1);
  });

  it("조회에는 요청 키를 싣지 않는다", async () => {
    const fetchImpl = vi.fn(async () => ok(null));
    const api = createRemoteGameApi({ getAccessToken: async () => "t", applyState: () => undefined, fetchImpl: fetchImpl as never });
    await api.getInventory();
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)).requestId).toBeUndefined();
  });

  it("거절 응답은 오류로 던지고 상태를 바꾸지 않는다", async () => {
    const applied: unknown[] = [];
    const api = createRemoteGameApi({ getAccessToken: async () => "t", applyState: (s) => applied.push(s),
      fetchImpl: (async () => new Response(JSON.stringify({ ok: false, code: "rejected", message: "재화가 부족합니다." }), { status: 422 })) as never });
    await expect(api.getInventory()).rejects.toMatchObject({ code: "rejected", message: "재화가 부족합니다." });
    expect(applied).toHaveLength(0);
  });

  it("토큰이 없으면 호출하지 않는다", async () => {
    const fetchImpl = vi.fn();
    const api = createRemoteGameApi({ getAccessToken: async () => null, applyState: () => undefined, fetchImpl: fetchImpl as never });
    await expect(api.getInventory()).rejects.toBeInstanceOf(RemoteGameApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("네트워크 단절은 같은 요청 키로 한 번 더 보낸다", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => { if (n++ === 0) throw new Error("net"); return ok(1); });
    const api = createRemoteGameApi({ getAccessToken: async () => "t", applyState: () => undefined, fetchImpl: fetchImpl as never, newRequestId: () => "rid-00000002" });
    expect(await api.markAttendanceAutoShown()).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
