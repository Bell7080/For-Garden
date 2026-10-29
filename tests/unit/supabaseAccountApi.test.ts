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
  it("fetchImpl을 주지 않으면 전역 fetch를 객체 메서드로 부르지 않는다(브라우저 Illegal invocation)", async () => {
    const original = globalThis.fetch;
    // 브라우저의 fetch처럼, window가 아닌 this로 불리면 던진다.
    globalThis.fetch = function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(json(session(1, 2_000_000)));
    } as unknown as typeof fetch;
    try {
      const api = new SupabaseAccountApi({ url: "https://x", key: "k", store: new MemoryStore(), now: () => 1_000_000, saveVersion: () => 50 });
      expect(await api.userId()).toBe("11111111-2222-3333-4444-555555555555");
    } finally { globalThis.fetch = original; }
  });

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

  it("가입 자체가 막혀 있어도 unsupported", async () => {
    const { api } = setup(() => json({ error_code: "signup_disabled" }, 422));
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

  it("소셜 로그인·게스트 병합은 아직 지원하지 않는다", async () => {
    const { api } = setup(() => json(session(1, 2_000_000)));
    expect(await api.login({ provider: "google", mergeGuestProgress: false })).toMatchObject({ ok: false, code: "unsupported" });
    expect(await api.mergeGuestSave({ requestId: "r", guestData: {}, expectedRemote: null })).toMatchObject({ ok: false, code: "guest-merge-unavailable" });
  });

  it("탈퇴는 삭제 요청 함수를 부른 뒤 이 기기의 로그인을 푼다", async () => {
    const { api, store, calls } = setup((path) => path.includes("/rpc/request_account_deletion") ? json({ ok: true, purge_after: "2026-11-05T00:00:00Z" }) : json(session(1, 2_000_000)));
    expect((await api.getState()).ok).toBe(true);
    expect(await api.requestWithdrawal()).toEqual({ ok: true, value: undefined });
    expect(calls.some((c) => c.path.endsWith("/rest/v1/rpc/request_account_deletion"))).toBe(true);
    expect(store.value).toBeNull();
  });

  it("탈퇴 요청을 서버가 거절하면 로그인을 풀지 않는다", async () => {
    const { api, store } = setup((path) => path.includes("/rpc/request_account_deletion") ? json({ ok: false }) : json(session(1, 2_000_000)));
    await api.getState();
    expect(await api.requestWithdrawal()).toMatchObject({ ok: false });
    expect(store.value).not.toBeNull();
  });

  it.each([429, 503])("일시적 refresh 실패(%s)는 기존 게스트 토큰을 지우지 않는다", async (status) => {
    const { api, store, calls } = setup(() => json({ code: "temporarily_unavailable" }, status));
    store.value = { accessToken: "old-guest", refreshToken: "keep-me", expiresAtMs: 0, userId: "existing" };
    expect((await api.getState()).ok).toBe(false);
    expect(store.value?.refreshToken).toBe("keep-me");
    await api.getState();
    expect(calls.every(call => call.path.includes("grant_type=refresh_token"))).toBe(true);
  });
  it("회원가입 제한의 Retry-After를 알려주고 기존 계정/토큰은 유지한다", async () => {
    const { api, store } = setup(() => new Response(JSON.stringify({ code: "rate_limited" }), { status: 429, headers: { "retry-after": "37" } }));
    const value={ accessToken: "old-guest", refreshToken: "keep-me", expiresAtMs: 2_000_000_000, userId: "existing" };store.value=value;
    expect(await api.registerWithId("garden_01", "correct horse")).toMatchObject({ ok: false, code: "rate-limited", retryAfterSeconds: 37 });
    expect(store.value).toEqual(value);
  });
  it("회원가입 응답이 다른 UID면 토큰을 바꾸지 않는다", async () => {
    const { api, store } = setup(() => json({ ok: true, userId: "different" }));
    store.value={ accessToken: "guest", refreshToken: "r", expiresAtMs: 2_000_000_000, userId: "original" };
    expect(await api.registerWithId("garden_01", "correct horse")).toMatchObject({ok:false,code:"network-error"});
    expect(store.value.userId).toBe("original");
  });

  describe("아이디·비밀번호 계정", () => {
    const jwt = (claims: Record<string, unknown>) => `h.${btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;
    const sessionWith = (claims: Record<string, unknown>, n = 1) => ({ access_token: jwt(claims), refresh_token: `r${n}`, expires_at: 2_000_000, user: { id: "11111111-2222-3333-4444-555555555555" } });

    it("아이디 로그인은 서버 별칭 경계를 통해 확인된 동일 UID의 세션을 받는다", async () => {
      const { api, store, calls } = setup(path => {
        if (path !== "/api/account") throw new Error("직접 합성 이메일 로그인 금지");
        return json(sessionWith({ is_anonymous: false, email: "player@example.com" }));
      });
      expect((await api.signInWithId("garden_01", "correct horse")).ok).toBe(true);
      expect(store.value?.userId).toBe("11111111-2222-3333-4444-555555555555");
      expect(JSON.parse(String(calls[0].init.body))).toEqual({action:"sign-in",id:"garden_01",password:"correct horse"});
    });

    it("가입 확정 뒤 로그인 응답만 실패하면 회원가입을 반복하지 않고 같은 UID로 복구한다", async () => {
      let attempt = 0;
      const { api, calls } = setup(path => {
        if (path === "/api/account") return json({ ok: true, userId: "11111111-2222-3333-4444-555555555555" });
        if (++attempt === 1) throw new TypeError("temporary disconnect");
        return json(sessionWith({ is_anonymous: false, email: "garden_01@id.forgarden.app" }));
      });
      expect(await api.registerWithId("garden_01", "correct horse")).toMatchObject({ ok: false, code: "network-error" });
      expect(await api.registerWithId("garden_01", "correct horse")).toMatchObject({ ok: true, value: { kind: "linked" } });
      expect(calls.filter(c => c.path === "/api/account")).toHaveLength(1);
      expect(calls.filter(c => c.path.includes("grant_type=password"))).toHaveLength(2);
    });

    it.each([
      { is_anonymous: true, email: "" },
      { is_anonymous: true, email: "pending@example.test" },
      { email: "" },
      { email: "   " },
    ])("저장된 게스트를 재접속해도 연동 대상으로 유지한다: %j", async (claims) => {
      const { api, store, calls } = setup((path) => {
        if (path === "/api/account") return json({ ok: true, userId: "guest-existing" });
        if (path.includes("grant_type=password")) return json({ ...sessionWith({ is_anonymous: false, email: "garden_01@id.forgarden.app" }, 2), user: { id: "guest-existing" } });
        throw new Error(`unexpected ${path}`);
      });
      // 이전 실행의 보안 저장소를 복원한다. 새 익명 가입이나 다른 UID로 교체해서는 안 된다.
      store.value = { accessToken: jwt(claims), refreshToken: "existing-refresh", expiresAtMs: 2_000_000_000, userId: "guest-existing" };
      expect(await api.getState()).toMatchObject({ ok: true, value: { kind: "guest", provider: "guest" } });
      expect(calls).toHaveLength(0);
      expect(await api.registerWithId("garden_01", "correct horse")).toMatchObject({ ok: true, value: { kind: "linked" } });
      expect(calls.map(c => c.path)).toEqual(["/api/account", "/auth/v1/token?grant_type=password"]);
      expect(calls[0].init.method).toBe("POST");
      expect(store.value?.userId).toBe("guest-existing");
      const restored = new SupabaseAccountApi({ url: "https://x", key: "k", store, fetchImpl: (async () => { throw new Error("restoration must not create a new user"); }) as typeof fetch, now: () => 1_000_000, saveVersion: () => 50 });
      expect(await restored.getState()).toMatchObject({ ok: true, value: { kind: "linked", provider: "password" } });
      expect(await restored.userId()).toBe("guest-existing");
    });

    it("만료된 게스트 토큰을 갱신해도 빈 이메일 때문에 연동 상태가 되지 않는다", async () => {
      const { api, store, calls } = setup(() => json(sessionWith({ is_anonymous: true, email: "" })));
      store.value = { accessToken: jwt({ is_anonymous: true, email: "" }), refreshToken: "old", expiresAtMs: 1, userId: "11111111-2222-3333-4444-555555555555" };
      expect(await api.getState()).toMatchObject({ ok: true, value: { kind: "guest" } });
      expect(calls.map(c => c.path)).toEqual(["/auth/v1/token?grant_type=refresh_token"]);
    });

    it("서버가 명시한 비익명 계정은 이메일이 비어도 게스트로 승격하지 않는다", async () => {
      const { api, store, calls } = setup(() => { throw new Error("must not call"); });
      store.value = { accessToken: jwt({ is_anonymous: false, email: "" }), refreshToken: "r", expiresAtMs: 2_000_000_000, userId: "linked" };
      expect(await api.getState()).toMatchObject({ ok: true, value: { kind: "linked" } });
      expect(await api.registerWithId("garden_01", "correct horse")).toMatchObject({ ok: false, code: "invalid-credentials" });
      expect(calls).toHaveLength(0);
    });

    it("처음 가입은 메일 없는 서버 가입 뒤 로그인하고 연동 상태를 돌려준다(비밀번호는 저장소에 남지 않는다)", async () => {
      const { api, store, calls } = setup(path => path === "/api/account" ? json({ ok: true, userId: "11111111-2222-3333-4444-555555555555" }) : json(sessionWith({ is_anonymous: false, email: "garden_01@id.forgarden.app" })));
      const result = await api.registerWithId("Garden_01", "correct horse");
      expect(result).toEqual({ ok: true, value: { kind: "linked", provider: "password", maskedId: "ga••••" } });
      expect(calls[0].path).toBe("/api/account");
      expect(JSON.parse(String(calls[0].init.body))).toEqual({ id: "Garden_01", password: "correct horse" });
      expect(JSON.stringify(store.value)).not.toContain("correct horse");
    });

    it("게스트가 있으면 같은 유저를 승격하고(/api/account) 토큰을 새로 받는다", async () => {
      const { api, store, calls } = setup((path, init) => {
        if (path === "/auth/v1/signup") return json(sessionWith({ is_anonymous: true }));
        if (path === "/api/account") return json({ ok: true, userId: "11111111-2222-3333-4444-555555555555" });
        if (path.includes("grant_type=password")) return json(sessionWith({ is_anonymous: false, email: "garden_01@id.forgarden.app" }, 2));
        throw new Error(`unexpected ${path} ${init.method}`);
      });
      expect((await api.getState()).ok).toBe(true);
      const result = await api.registerWithId("garden_01", "correct horse");
      expect(result).toMatchObject({ ok: true, value: { kind: "linked", provider: "password" } });
      const put = calls.find((c) => c.path === "/api/account");
      expect(put?.init.method).toBe("POST");
      expect(JSON.parse(String(put?.init.body))).toEqual({ id: "garden_01", password: "correct horse" });
      expect(store.value?.refreshToken).toBe("r2");
    });

    it("이미 쓰는 아이디·약한 비밀번호·잘못된 로그인·과도한 시도를 코드로 가른다", async () => {
      const reg = (errorCode: string, status = 422) => setup(() => json({ code: errorCode === "user_already_exists" ? "id_taken" : errorCode }, status)).api.registerWithId("garden_01", "correct horse");
      expect(await reg("user_already_exists")).toMatchObject({ ok: false, code: "id-taken" });
      expect(await reg("weak_password")).toMatchObject({ ok: false, code: "weak-password" });
      const login = (errorCode: string, status: number) => setup(() => json({ error_code: errorCode }, status)).api.signInWithId("garden_01", "wrong pass");
      expect(await login("invalid_credentials", 400)).toMatchObject({ ok: false, code: "invalid-credentials" });
      expect(await login("over_request_rate_limit", 429)).toMatchObject({ ok: false, code: "rate-limited" });
    });

    it("규칙에 맞지 않는 입력은 서버를 부르지 않는다", async () => {
      const { api, calls } = setup(() => json({}));
      expect(await api.registerWithId("ab", "correct horse")).toMatchObject({ ok: false, code: "invalid-id" });
      expect(await api.registerWithId("garden_01", "short")).toMatchObject({ ok: false, code: "weak-password" });
      expect(await api.signInWithId("a b", "x")).toMatchObject({ ok: false, code: "invalid-credentials" });
      expect(calls).toHaveLength(0);
    });

    it("다른 기기 로그인은 서버 별칭으로 들어가 같은 계정의 토큰을 보관한다", async () => {
      const { api, store, calls } = setup(() => json(sessionWith({ is_anonymous: false, email: "garden_01@id.forgarden.app" })));
      const result = await api.signInWithId("GARDEN_01", "correct horse");
      expect(result).toMatchObject({ ok: true, value: { kind: "linked" } });
      expect(calls[0].path).toBe("/api/account");
      expect(store.value?.userId).toBe("11111111-2222-3333-4444-555555555555");
    });

    it("로그아웃은 새 게스트를 만들지 않아 타이틀이 로그인 선택을 다시 보여 준다", async () => {
      const { api, store, calls } = setup(() => json(sessionWith({ is_anonymous: false, email: "garden_01@id.forgarden.app" })));
      await api.signInWithId("garden_01", "correct horse");
      calls.length = 0;
      expect((await api.logout()).ok).toBe(true);
      expect(calls).toHaveLength(0);
      expect(store.value).toBeNull();
      expect(await api.hasSession()).toBe(false);
    });
  });
});

describe('로그아웃과 토큰 갱신 경합',()=>{
 it('로그아웃 삭제 대기 중 조회가 저장소의 옛 토큰을 다시 불러오지 않는다',async()=>{
  let finishClear!:()=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const store=new MemoryStore();store.value={accessToken:'old',refreshToken:'r',userId:'old-user',expiresAtMs:2000000000};
  store.clear=async()=>{began();await new Promise<void>(r=>{finishClear=r;});store.value=null;};
  const api=new SupabaseAccountApi({url:'https://x',key:'k',store,fetchImpl:(async()=>{throw Error('must not create guest');}) as typeof fetch,now:()=>1000000,saveVersion:()=>50});
  const logout=api.logout();await started;
  expect(await api.hasSession()).toBe(false);expect(await api.getState()).toMatchObject({ok:false,code:'cancelled'});
  finishClear();await logout;expect(await api.hasSession()).toBe(false);
 });
 it('다른 아이디 로그인 뒤 도착한 이전 계정 갱신을 폐기한다',async()=>{
  let deliver!:(r:Response)=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const {api,store}=setup(path=>path==='/api/account'?json(session(3,2000000)):(began(),new Promise<Response>(r=>{deliver=r;})));
  store.value={accessToken:'old',refreshToken:'old-refresh',userId:'old-user',expiresAtMs:0};
  const refresh=api.getState();await started;
  expect((await api.signInWithId('garden_01','correct horse')).ok).toBe(true);
  deliver(json(session(2,2000000)));
  expect(await refresh).toMatchObject({ok:false,code:'cancelled'});
  expect(store.value?.accessToken).toBe('a3');expect(await api.accessToken()).toBe('a3');
 });
 it('로그아웃 뒤 도착한 아이디 로그인 응답을 저장하지 않는다',async()=>{
  let deliver!:(r:Response)=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const {api,store}=setup(()=>{began();return new Promise<Response>(r=>{deliver=r;});});
  const login=api.signInWithId('garden_01','correct horse');await started;await api.logout();
  deliver(json(session(2,2000000)));
  expect(await login).toMatchObject({ok:false,code:'cancelled'});
  expect(store.value).toBeNull();expect(await api.hasSession()).toBe(false);
 });
 it('플랫폼 토큰 저장이 늦어도 로그아웃 clear가 마지막에 실행된다',async()=>{
  let finishSave!:()=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const store=new MemoryStore();
  store.save=async tokens=>{began();await new Promise<void>(r=>{finishSave=r;});store.value=tokens;};
  const api=new SupabaseAccountApi({url:'https://x',key:'k',store,fetchImpl:(async()=>json(session(1,2000000))) as typeof fetch,now:()=>1000000,saveVersion:()=>50});
  const pending=api.getState();await started;const logout=api.logout();finishSave();
  expect(await pending).toMatchObject({ok:false,code:'cancelled'});expect((await logout).ok).toBe(true);
  expect(store.value).toBeNull();expect(await api.hasSession()).toBe(false);
 });
 it('이전 계정 RPC의 늦은 401이 새 로그인 토큰을 지우지 않는다',async()=>{
  let deliver!:(r:Response)=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const {api,store}=setup(path=>path==='/api/account'?json(session(3,2000000)):(began(),new Promise<Response>(r=>{deliver=r;})));
  store.value={accessToken:'old',refreshToken:'old-refresh',userId:'old-user',expiresAtMs:2000000000};
  const rpc=api.callRpc('get_my_save_meta',{});await started;
  await api.signInWithId('garden_01','correct horse');deliver(json({},401));await rpc;
  expect(await api.accessToken()).toBe('a3');
 });
 it('로그아웃 전에 시작한 갱신 응답이 저장된 로그인 상태를 되살리지 않는다',async()=>{
  let deliver!:(r:Response)=>void;let began!:()=>void;const started=new Promise<void>(r=>{began=r;});
  const {api,store}=setup(()=>{began();return new Promise<Response>(r=>{deliver=r;});});
  store.value={accessToken:'old',refreshToken:'old-refresh',userId:'old-user',expiresAtMs:0};
  const pending=api.getState();await started;expect((await api.logout()).ok).toBe(true);
  deliver(json(session(2,2000000)));expect(await pending).toMatchObject({ok:false,code:'cancelled'});
  expect(store.value).toBeNull();expect(await api.hasSession()).toBe(false);
 });
});
