import { describe, expect, it } from "vitest";
import { SupportApi, type RpcCaller } from "../../src/api/SupportApi";
import { createWebTokenStore } from "../../src/api/webTokenStore";
import { installBackend } from "../../src/api/backendSession";
import { accountApi } from "../../src/api/AccountApi";

const fake = (value: unknown, ok = true): RpcCaller & { calls: Array<[string, Record<string, unknown>]> } => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  return { calls, async callRpc(name, args) { calls.push([name, args]); return ok ? { ok: true, value } : { ok: false, code: "network-error", message: "x" }; } };
};
const meta = { version: "0.293.0", platform: "web" };

describe("SupportApi", () => {
  it("접수는 버전·플랫폼을 함께 보내고 번호를 돌려준다", async () => {
    const rpc = fake({ ok: true, id: "i1", ticket_no: 7 });
    const r = await new SupportApi(rpc, meta).submit({ category: "bug", subject: "s", body: "b" });
    expect(r).toEqual({ ok: true, value: { id: "i1", ticketNo: 7 } });
    expect(rpc.calls[0]).toEqual(["submit_ticket", { p_category: "bug", p_subject: "s", p_body: "b", p_reported_uid: null, p_version: "0.293.0", p_platform: "web" }]);
  });
  it("서버가 거절하면 오류 코드를 그대로, 모르는 코드는 network로 돌려준다", async () => {
    expect(await new SupportApi(fake({ ok: false, error: "rate_limited" }), meta).submit({ category: "inquiry", subject: "s", body: "b" })).toEqual({ ok: false, error: "rate_limited" });
    expect(await new SupportApi(fake({ ok: false, error: "weird" }), meta).submit({ category: "inquiry", subject: "s", body: "b" })).toEqual({ ok: false, error: "network" });
    expect(await new SupportApi(fake(null, false), meta).listMine()).toEqual({ ok: false, error: "network" });
  });
  it("서버에 연결되지 않은 빌드는 unsupported다", async () => {
    expect(await new SupportApi(null, meta).listMine()).toEqual({ ok: false, error: "unsupported" });
  });
  it("목록과 상세를 화면 모양으로 바꾼다", async () => {
    const list = await new SupportApi(fake([{ id: "a", ticket_no: 1, category: "bug", subject: "s", status: "open", created_at: "c", updated_at: "u" }]), meta).listMine();
    expect(list).toEqual({ ok: true, value: [{ id: "a", ticketNo: 1, category: "bug", subject: "s", status: "open", createdAt: "c", updatedAt: "u" }] });
    const one = await new SupportApi(fake({ id: "a", ticket_no: 1, category: "bug", subject: "s", body: "b", status: "answered", created_at: "c", messages: [{ author: "staff", body: "m", at: "t" }] }), meta).get("a");
    expect(one.ok && one.value.messages).toEqual([{ author: "staff", body: "m", at: "t" }]);
    expect(await new SupportApi(fake(null), meta).get("zz")).toEqual({ ok: false, error: "not_found" });
  });
});

describe("웹 토큰 보관소와 연결", () => {
  it("보관소는 저장·복원·삭제하고 깨진 값은 null로 본다", async () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const store = createWebTokenStore(storage)!;
    expect(store).not.toBeNull();
    const tokens = { accessToken: "a", refreshToken: "r", expiresAtMs: 5, userId: "u" };
    await store.save(tokens);
    expect(await store.load()).toEqual(tokens);
    mem.set([...mem.keys()][0], "{bad");
    expect(await store.load()).toBeNull();
    await store.clear();
    expect(mem.size).toBe(0);
  });
  it("설정이나 보관소가 없으면 연결하지 않는다", () => {
    expect(installBackend({ url: undefined, key: undefined, store: null })).toBeNull();
    expect(installBackend({ url: "https://x", key: "k", store: null })).toBeNull();
    expect(accountApi.constructor.name).toBe("UnsupportedAccountApi");
  });
});
