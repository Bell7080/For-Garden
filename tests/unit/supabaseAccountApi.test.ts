import { describe, expect, it } from "vitest";
import { SupabaseAccountApi, type StoredTokens, type TokenStore } from "../../src/api/SupabaseAccountApi";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
class MemoryStore implements TokenStore {
  value: StoredTokens | null = null;
  async load() { return this.value; }
  async save(t: StoredTokens) { this.value = t; }
  async clear() { this.value = null; }
}
const session = (n: number, expiresAt: number) => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_at: expiresAt, user: { id: "11111111-2222-3333-4444-555555555555" } });

function setup(handler: (path: string, init: RequestInit) => Response | Promise<Response>, now = () => 1_000_000) {
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const store = new MemoryStore();
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input).replace("https://x", "");
    calls.push({ path, init });
    return handler(path, init);
  }) as typeof fetch;
  const api = new SupabaseAccountApi({ url: "https://x", key: "k", store, fetchImpl, now, saveVersion: () => 50 });
  return { api, store, calls };
}

describe("SupabaseAccountApi", () => {
  it("토큰이 없으면 게스트로 가입해 보안 저장소에 맡기고 마스킹된 ID를 돌려준다", async () => {
    const { api, store, calls } = setup(() => json(session(1, 2_000_000)));
    const state = await api.getState();
    expect(state).toEqual({ ok: true, value: { kind: "guest", provider: "guest", maskedId: "GUEST-1111••••" } });
    expect(store.value?.accessToken).toBe("a1");
    expect(calls[0].path).toBe("/auth/v1/signup");
    expect(JSON.stringify(state)).not.toContain("a1");
  });

  it("동시에 여러 요청이 와도 가입은 한 번만 한다", async () => {
    const { api, calls } = setup((path) => (path.includes("signup") ? json(session(1, 2_000_000)) : json(null)));
    await Promise.all([api.getRemoteSaveMetadata(), api.getRemoteSaveMetadata(), api.getRemoteSaveMetadata()]);
    expect(calls.filter((c) => c.path.includes("signup"))).toHaveLength(1);
  });

  it("만료가 가까우면 리프레시 토큰으로 갱신한다", async () => {
    const { api, store, calls } = setup((path) => (path.includes("grant_type=refresh_token") ? json(session(2, 9_000)) : json(null)), () => 1_000_000);
    store.value = { accessToken: "old", refreshToken: "r0", expiresAtMs: 1_000_000 + 10_000, userId: "u" };
    await api.getRemoteSaveMetadata();
    expect(calls[0].path).toContain("grant_type=refresh_token");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ refresh_token: "r0" });
    expect(store.value?.accessToken).toBe("a2");
  });

  it("익명 가입이 꺼져 있으면 성공을 흉내 내지 않고 unsupported", async () => {
    const { api } = setup(() => json({ error_code: "anonymous_provider_disabled" }, 422));
    expect(await api.getState()).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("저장이 없으면 null, 있으면 메타데이터를 해석한다", async () => {
    let body: unknown = null;
    const { api } = setup((path) => (path.includes("signup") ? json(session(1, 2_000_000)) : json(body)));
    expect(await api.getRemoteSaveMetadata()).toEqual({ ok: true, value: null });
    body = { revision: "3", etag: "h", dataHash: "h", saveVersion: 50, serverModifiedAt: "t", summary: { playerLevel: 7, currency: { gems: 1, gold: 2 }, lastPlayedAt: "x" } };
    const r = await api.getRemoteSaveMetadata();
    expect(r).toMatchObject({ ok: true, value: { revision: "3", dataHash: "h", summary: { playerLevel: 7 } } });
  });

  it("업로드는 읽은 revision을 조건으로 보내고, 충돌은 save-conflict", async () => {
    let status = 200;
    const { api, calls } = setup((path) => {
      if (path.includes("signup")) return json(session(1, 2_000_000));
      return status === 200 ? json({ revision: "4", etag: "h", dataHash: "h", saveVersion: 50, serverModifiedAt: "t", summary: {} }) : json({ message: "save_conflict" }, 409);
    });
    const ok = await api.uploadRemoteSave({ wallet: { gems: 5, gold: 6 }, playerResearch: { level: 9 } }, { revision: "3", etag: "h" });
    expect(ok.ok).toBe(true);
    const sent = JSON.parse(String(calls.find((c) => c.path.endsWith("upload_my_save"))!.init.body));
    expect(sent.p_expected_revision).toBe(3);
    expect(sent.p_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.p_summary).toMatchObject({ playerLevel: 9, currency: { gems: 5, gold: 6 } });
    status = 409;
    expect(await api.uploadRemoteSave({}, null)).toMatchObject({ ok: false, code: "save-conflict" });
  });

  it("소셜 로그인·탈퇴·게스트 병합은 아직 지원하지 않는다", async () => {
    const { api } = setup(() => json(session(1, 2_000_000)));
    expect(await api.login({ provider: "google", mergeGuestProgress: false })).toMatchObject({ ok: false, code: "unsupported" });
    expect(await api.requestWithdrawal()).toMatchObject({ ok: false, code: "unsupported" });
    expect(await api.mergeGuestSave({ requestId: "r", guestData: {}, expectedRemote: null })).toMatchObject({ ok: false, code: "guest-merge-unavailable" });
  });
});
