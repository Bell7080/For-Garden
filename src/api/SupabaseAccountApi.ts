/**
 * Supabase 계정·클라우드 저장 어댑터(`AccountApi` 구현).
 *
 * 토큰은 이 파일 밖으로 나가지 않는다 — `Session`·`SaveData`·`localStorage`에 두지 않고, 주입받은
 * 보안 저장소(`TokenStore`: 네이티브 보안 저장소 또는 HttpOnly 서버 세션 어댑터)에만 맡긴다.
 * 보안 저장소가 없는 빌드는 이 클래스를 만들지 않고 `UnsupportedAccountApi`에 머문다(성공을 흉내 내지 않는다).
 * 게스트(익명) 계정, 아이디·비밀번호 계정(메일 인증 없음), 저장 동기화를 지원하고 소셜 로그인·탈퇴는 `unsupported`다.
 * 아이디 계정은 게스트를 **같은 유저 그대로 승격**한다(`/api/account`) — 유저 ID가 같아 서버 진행이 그대로 따라온다.
 * 추후 소셜 로그인도 같은 유저에 정체성을 더하는 방식으로 붙여 양방향 연동이 되게 한다.
 */
import { t } from "../i18n";
import { accountCredentialProblem, accountIdProblem, accountIdToAuthEmail, authEmailToAccountId, maskAccountId } from "../core/accountCredentials";
import type {
  AccountApi, AccountFailureCode, AccountResult, AccountState, GuestSaveMergeRequest, LoginRequest,
  RemoteSaveDocument, RemoteSaveMetadata, RemoteSavePrecondition,
} from "./AccountApi";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** 액세스 토큰 만료 시각(ms, 서버 응답의 expires_at). */
  expiresAtMs: number;
  userId: string;
}

/** 플랫폼 보안 저장소 계약. 구현은 네이티브 어댑터가 주입한다. */
export interface TokenStore {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface SupabaseAccountOptions {
  url: string;
  key: string;
  store: TokenStore;
  fetchImpl?: typeof fetch;
  now?: () => number;
  saveVersion: () => number;
  registrationEndpoint?: string;
}

const fail = <T>(code: AccountFailureCode, message: string): AccountResult<T> => ({ ok: false, code, message });
/** 만료 직전에 요청이 401이 되지 않도록 여유를 둔다. */
const REFRESH_MARGIN_MS = 60_000;

export class SupabaseAccountApi implements AccountApi {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private tokens: StoredTokens | null = null;
  private pending: Promise<AccountResult<StoredTokens>> | null = null;
  private failure = "";
  private pendingRegistration?: { id: string; userId: string };

  constructor(private readonly options: SupabaseAccountOptions) {
    // 브라우저의 fetch는 window가 아닌 객체의 메서드로 부르면 "Illegal invocation"으로 던진다 — 한 번 감싸 둔다.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? Date.now;
  }

  async getState(): Promise<AccountResult<AccountState>> {
    const auth = await this.ensureTokens();
    if (!auth.ok) return auth;
    return { ok: true, value: stateOf(auth.value) };
  }

  /** 이 기기에 이미 만들어진 계정(게스트 포함)이 있는가. 네트워크를 쓰지 않는다. 첫 실행 화면이 로그인 버튼을 세울지 정한다. */
  async hasSession(): Promise<boolean> {
    try { this.tokens ??= await this.options.store.load(); } catch { return false; }
    return this.tokens !== null;
  }

  /** 가장 최근 인증 실패의 짧은 진단 문자열이다(토큰·키는 담지 않는다). 연결 실패 안내의 진단 코드로 쓴다. */
  lastFailure(): string { return this.failure; }

  /** 서버 호출용 액세스 토큰을 그때그때 꺼내 준다. 보관하지 않고 만료 전이면 갱신한다. 실패하면 `null`이다. */
  async accessToken(): Promise<string | null> {
    const auth = await this.ensureTokens();
    return auth.ok ? auth.value.accessToken : null;
  }

  /** 이 기기에 연결된 계정 ID. 토큰이 아니라 식별자라 기기에 어느 계정의 진행이 있는지 기억하는 데만 쓴다. */
  async userId(): Promise<string | null> {
    const auth = await this.ensureTokens();
    return auth.ok ? auth.value.userId : null;
  }

  async login(_request: LoginRequest): Promise<AccountResult<AccountState>> { return this.unsupported(); }
  async requestWithdrawal(): Promise<AccountResult<void>> { return this.unsupported(); }
  async mergeGuestSave(_request: GuestSaveMergeRequest): Promise<AccountResult<RemoteSaveDocument>> { return fail("guest-merge-unavailable", t("error.account.mergeUnavailable")); }

  async logout(): Promise<AccountResult<AccountState>> {
    this.tokens = null; this.pendingRegistration = undefined;
    try { await this.options.store.clear(); } catch { return fail("network-error", t("error.account.logoutFailed")); }
    // 새 게스트를 여기서 만들지 않는다 — 로그아웃 뒤에는 타이틀이 로그인 선택(게스트·아이디 계정)을 보여 준다.
    return { ok: true, value: { kind: "guest", provider: "guest", maskedId: "GUEST-••••" } };
  }

  async registerWithId(id: string, password: string): Promise<AccountResult<AccountState>> {
    const problem = accountCredentialProblem(id, password);
    if (problem) return fail(problem.startsWith("id") ? "invalid-id" : "weak-password", t("error.account.credentials"));
    const email = accountIdToAuthEmail(id);
    try {
      this.tokens ??= await this.options.store.load();
      const current = this.tokens;
      if (current && !isAnonymous(current)) return fail("invalid-credentials", t("error.account.alreadyLinked"));
      // 관리자 비밀번호 설정은 기존 세션을 종료한다. 응답 이후 로그인만 실패했다면 인증된 같은 UID로만 재시도한다.
      if (this.pendingRegistration?.id === email && (!current || current.userId === this.pendingRegistration.userId)) return await this.finishRegistration(email, password, this.pendingRegistration.userId);
      const fresh = current ? await this.ensureTokens() : null;
      if (fresh && !fresh.ok) return fresh;
      const registered = await this.fetchImpl(this.options.registrationEndpoint ?? "/api/account", {
        method: "POST", headers: { "Content-Type": "application/json", ...(fresh?.ok ? { Authorization: `Bearer ${fresh.value.accessToken}` } : {}) },
        body: JSON.stringify({ id, password }), signal: AbortSignal.timeout(35000),
      });
      if (!registered.ok) {
        const detail = await registered.json().catch(() => ({})) as { code?: string };
        this.failure = `register:${registered.status}:${detail.code ?? "unknown"}`;
        if (detail.code === "id_taken") return fail("id-taken", t("error.account.idTaken"));
        if (detail.code === "weak_password") return fail("weak-password", t("error.account.credentials"));
        if (registered.status === 429) return this.rateFailure(registered);
        if (registered.status === 401) return fail("invalid-credentials", t("error.account.badLogin"));
        return fail("network-error", t("account.id.serverUnavailable"));
      }
      const result = await registered.json() as { userId?: string };
      if (!result.userId || (current && result.userId !== current.userId)) return fail("network-error", t("error.account.authResponse"));
      this.pendingRegistration = { id: email, userId: result.userId };
      return await this.finishRegistration(email, password, result.userId);
    } catch (error) {
      this.failure = `register-exception:${error instanceof Error ? error.name : "unknown"}`;
      return fail("network-error", t("error.account.network"));
    }
  }

  private async finishRegistration(email: string, password: string, expectedUserId: string): Promise<AccountResult<AccountState>> {
    const signed = await this.authCall("/auth/v1/token?grant_type=password", JSON.stringify({ email, password }));
    if (!signed.ok) return signed;
    if (signed.value.userId !== expectedUserId) return fail("network-error", t("error.account.authResponse"));
    const result = await this.adopt(signed.value);
    this.pendingRegistration = undefined;
    return result;
  }

  async signInWithId(id: string, password: string): Promise<AccountResult<AccountState>> {
    // 로그인에서는 규칙 위반을 '틀린 아이디 또는 비밀번호'와 구별하지 않는다 — 계정 존재 여부를 흘리지 않는다.
    if (accountIdProblem(id) || password.length === 0) return fail("invalid-credentials", t("error.account.badLogin"));
    try {
      let signed = await this.authCall("/auth/v1/token?grant_type=password", JSON.stringify({ email: accountIdToAuthEmail(id), password }));
      if (!signed.ok && signed.code === "email-unconfirmed") {
        const confirmed = await this.fetchImpl(this.options.registrationEndpoint ?? "/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm-existing", id, password }), signal: AbortSignal.timeout(35000) });
        if (!confirmed.ok) {
          if (confirmed.status === 429) return this.rateFailure(confirmed);
          return fail(confirmed.status === 401 ? "invalid-credentials" : "network-error", t(confirmed.status === 401 ? "error.account.badLogin" : "account.id.serverUnavailable"));
        }
        const result = await confirmed.json() as { userId?: string };
        if (!result.userId) return fail("network-error", t("error.account.authResponse"));
        signed = await this.authCall("/auth/v1/token?grant_type=password", JSON.stringify({ email: accountIdToAuthEmail(id), password }));
        if (signed.ok && signed.value.userId !== result.userId) return fail("network-error", t("error.account.authResponse"));
      }
      return signed.ok ? this.adopt(signed.value) : signed;
    } catch (error) {
      this.failure = `signin-exception:${error instanceof Error ? error.name : "unknown"}`;
      return fail("network-error", t("error.account.network"));
    }
  }

  private async adopt(tokens: StoredTokens): Promise<AccountResult<AccountState>> {
    await this.options.store.save(tokens);
    this.tokens = tokens; this.pendingRegistration = undefined;
    return { ok: true, value: stateOf(tokens) };
  }

  async getRemoteSaveMetadata(): Promise<AccountResult<RemoteSaveMetadata | null>> {
    const r = await this.rpc("get_my_save_meta", {});
    if (!r.ok) return r;
    return { ok: true, value: r.value === null ? null : this.metadata(r.value) };
  }

  async downloadRemoteSave(): Promise<AccountResult<RemoteSaveDocument>> {
    const r = await this.rpc("download_my_save", {});
    if (!r.ok) return r;
    const body = r.value as { metadata?: unknown; data?: unknown } | null;
    const metadata = body?.metadata ? this.metadata(body.metadata) : null;
    if (!metadata) return fail("invalid-remote-save", t("error.save.invalid"));
    return { ok: true, value: { metadata, data: body?.data } };
  }

  async uploadRemoteSave(data: unknown, expectedRemote: RemoteSavePrecondition | null): Promise<AccountResult<RemoteSaveMetadata>> {
    const hash = await sha256Hex(canonical(data));
    const r = await this.rpc("upload_my_save", {
      p_data: data, p_hash: hash, p_version: this.options.saveVersion(), p_summary: summaryOf(data),
      p_expected_revision: expectedRemote ? Number(expectedRemote.revision) : null,
    });
    if (!r.ok) return r;
    const metadata = this.metadata(r.value);
    return metadata ? { ok: true, value: metadata } : fail("invalid-remote-save", t("error.save.invalid"));
  }

  async deleteRemoteSave(expectedRemote: RemoteSavePrecondition): Promise<AccountResult<void>> {
    const r = await this.rpc("remove_my_save", { p_expected_revision: Number(expectedRemote.revision) });
    return r.ok ? { ok: true, value: undefined } : r;
  }

  private metadata(raw: unknown): RemoteSaveMetadata | null {
    const m = raw as Record<string, unknown> | null;
    if (!m || typeof m.revision !== "string" || typeof m.etag !== "string" || typeof m.dataHash !== "string") return null;
    const s = (m.summary ?? {}) as { playerLevel?: number; currency?: { gems?: number; gold?: number }; lastPlayedAt?: string };
    return {
      revision: m.revision, etag: m.etag, dataHash: m.dataHash,
      saveVersion: typeof m.saveVersion === "number" ? m.saveVersion : 1,
      serverModifiedAt: typeof m.serverModifiedAt === "string" ? m.serverModifiedAt : "",
      summary: {
        playerLevel: s.playerLevel ?? 1,
        currency: { gems: s.currency?.gems ?? 0, gold: s.currency?.gold ?? 0 },
        lastPlayedAt: s.lastPlayedAt ?? "",
      },
    };
  }

  /** 로그인한 계정으로 DB 함수를 부른다. 토큰은 이 클래스 밖으로 나가지 않고 호출 결과만 나간다. */
  async callRpc(name: string, args: Record<string, unknown>): Promise<AccountResult<unknown>> { return this.rpc(name, args); }

  private async rpc(name: string, args: Record<string, unknown>): Promise<AccountResult<unknown>> {
    const auth = await this.ensureTokens();
    if (!auth.ok) return auth;
    try {
      const res = await this.fetchImpl(`${this.options.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { apikey: this.options.key, Authorization: `Bearer ${auth.value.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (res.ok) return { ok: true, value: await res.json() };
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      if (err?.message === "save_conflict") return fail("save-conflict", t("error.save.changed"));
      if (res.status === 401) this.tokens = null;
      this.failure = `rpc:${name}:${res.status}:${String(err?.message ?? "-").slice(0, 60)}`;
      return fail("network-error", err?.message ?? t("error.account.requestFailed", { status: res.status }));
    } catch (error) {
      this.failure = `rpc-exception:${name}:${error instanceof Error ? error.name : "unknown"}`;
      return fail("network-error", t("error.account.network"));
    }
  }

  /** 토큰이 없으면 게스트(익명)로 가입하고, 만료가 가까우면 갱신한다. 동시에 여러 요청이 와도 한 번만 묻는다. */
  private ensureTokens(): Promise<AccountResult<StoredTokens>> {
    this.pending ??= this.resolveTokens().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async resolveTokens(): Promise<AccountResult<StoredTokens>> {
    try {
      this.tokens ??= await this.options.store.load();
      const current = this.tokens;
      if (current && current.expiresAtMs - this.now() > REFRESH_MARGIN_MS) return { ok: true, value: current };
      const next = current ? await this.refresh(current.refreshToken) : await this.signInAnonymously();
      if (!next.ok) return next;
      this.tokens = next.value;
      await this.options.store.save(next.value);
      return next;
    } catch (error) {
      this.failure = `auth-exception:${error instanceof Error ? error.name : "unknown"}`;
      return fail("network-error", t("error.account.network"));
    }
  }

  private signInAnonymously(): Promise<AccountResult<StoredTokens>> {
    return this.authCall("/auth/v1/signup", "{}");
  }

  private async refresh(refreshToken: string): Promise<AccountResult<StoredTokens>> {
    const r = await this.authCall("/auth/v1/token?grant_type=refresh_token", JSON.stringify({ refresh_token: refreshToken }));
    // 리프레시 토큰이 폐기됐다면(다른 기기 로그아웃 등) 낡은 토큰을 지우고 처음부터 게스트를 새로 만든다.
    if (!r.ok && r.code === "unsupported") return r;
    if (!r.ok && r.code === "invalid-credentials") { this.tokens = null; await this.options.store.clear(); }
    return r;
  }

  private async authCall(path: string, body: string): Promise<AccountResult<StoredTokens>> {
    const res = await this.fetchImpl(`${this.options.url}${path}`, {
      method: "POST", headers: { apikey: this.options.key, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return this.authFailure(path, res);
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const user = j?.user as { id?: string } | undefined;
    if (typeof j?.access_token !== "string" || typeof j?.refresh_token !== "string" || typeof user?.id !== "string") {
      return fail("network-error", t("error.account.authResponse"));
    }
    const expiresAt = typeof j.expires_at === "number" ? j.expires_at * 1000 : this.now() + (Number(j.expires_in) || 3600) * 1000;
    return { ok: true, value: { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAtMs: expiresAt, userId: user.id } };
  }

  /** 인증 서비스의 실패 응답을 플레이어가 고칠 수 있는 코드로 옮긴다. 본문의 비밀번호·토큰은 읽지도 남기지도 않는다. */
  private async authFailure<T>(path: string, res: Response): Promise<AccountResult<T>> {
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const code = typeof j?.error_code === "string" ? j.error_code : typeof j?.code === "string" ? j.code : "-";
    this.failure = `auth:${path.split("?")[0]}:${res.status}:${code}`;
    // 서버에서 익명 가입이 꺼져 있으면 게스트 계정을 만들 수 없다 — 실패를 성공으로 꾸미지 않는다.
    if (code === "anonymous_provider_disabled" || code === "signup_disabled") return fail("unsupported", t("error.account.guestDisabled"));
    if (code === "email_exists" || code === "user_already_exists") return fail("id-taken", t("error.account.idTaken"));
    if (code === "weak_password" || code === "same_password") return fail("weak-password", t("error.account.credentials"));
    if (code === "email_not_confirmed") return fail("email-unconfirmed", t("error.account.badLogin"));
    if (code === "invalid_credentials") return fail("invalid-credentials", t("error.account.badLogin"));
    if (res.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return this.rateFailure(res);
    if (path.includes("grant_type=refresh_token") && (res.status === 401 || ["refresh_token_not_found", "refresh_token_already_used", "invalid_refresh_token"].includes(code))) return fail("invalid-credentials", t("error.account.badLogin"));
    return fail("network-error", t("error.account.authFailed", { status: res.status }));
  }

  private rateFailure<T>(res: Response): AccountResult<T> {
    const raw = res.headers.get("retry-after");
    const seconds = raw === null ? NaN : /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - this.now()) / 1000);
    const retry = Number.isFinite(seconds) ? Math.max(1, Math.min(86400, seconds)) : undefined;
    return { ok: false, code: "rate-limited", message: retry ? t("account.id.retryAfter", { seconds: retry }) : t("error.account.rateLimited"), ...(retry ? { retryAfterSeconds: retry } : {}) };
  }

  private unsupported<T>(): AccountResult<T> { return fail("unsupported", t("error.account.loginUnsupported")); }
}

/** 액세스 토큰(JWT)의 공개 claim만 읽는다. 서명 검증은 서버 몫이고, 여기서는 표시에만 쓴다. */
function claimsOf(tokens: StoredTokens): { email?: unknown; is_anonymous?: unknown } {
  try {
    const payload = tokens.accessToken.split(".")[1] ?? "";
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(base64)) as { email?: unknown; is_anonymous?: unknown };
  } catch { return {}; }
}

function isAnonymous(tokens: StoredTokens): boolean {
  const claims = claimsOf(tokens);
  // 익명 여부가 있으면 이메일보다 우선한다. Supabase 게스트 JWT에도 email: ""이 들어간다.
  if (typeof claims.is_anonymous === "boolean") return claims.is_anonymous;
  // 구형 토큰/읽을 수 없는 claim은 실제 주소가 있을 때만 연동으로 본다.
  return typeof claims.email !== "string" || claims.email.trim().length === 0;
}

function stateOf(tokens: StoredTokens): AccountState {
  if (isAnonymous(tokens)) return { kind: "guest", provider: "guest", maskedId: `GUEST-${tokens.userId.slice(0, 4)}••••` };
  const id = authEmailToAccountId(claimsOf(tokens).email);
  return { kind: "linked", provider: "password", maskedId: id ? maskAccountId(id) : `ID-${tokens.userId.slice(0, 4)}••••` };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 충돌 화면이 비교할 요약. 저장 본문에서 레벨·재화·최근 시각만 뽑는다(없으면 기본값). */
function summaryOf(data: unknown): Record<string, unknown> {
  const d = data as { playerResearch?: { level?: number }; wallet?: { gems?: number; gold?: number }; staminaUpdatedAt?: string } | null;
  return {
    playerLevel: d?.playerResearch?.level ?? 1,
    currency: { gems: d?.wallet?.gems ?? 0, gold: d?.wallet?.gold ?? 0 },
    lastPlayedAt: d?.staminaUpdatedAt ?? "",
  };
}
