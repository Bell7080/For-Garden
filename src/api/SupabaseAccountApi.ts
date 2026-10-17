/**
 * Supabase 계정·클라우드 저장 어댑터(`AccountApi` 구현).
 *
 * 토큰은 이 파일 밖으로 나가지 않는다 — `Session`·`SaveData`·`localStorage`에 두지 않고, 주입받은
 * 보안 저장소(`TokenStore`: 네이티브 보안 저장소 또는 HttpOnly 서버 세션 어댑터)에만 맡긴다.
 * 보안 저장소가 없는 빌드는 이 클래스를 만들지 않고 `UnsupportedAccountApi`에 머문다(성공을 흉내 내지 않는다).
 * 지금은 게스트(익명) 계정과 저장 동기화만 지원하고, 소셜 로그인·탈퇴는 `unsupported`다.
 */
import { t } from "../i18n";
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

  constructor(private readonly options: SupabaseAccountOptions) {
    // 브라우저의 fetch는 window가 아닌 객체의 메서드로 부르면 "Illegal invocation"으로 던진다 — 한 번 감싸 둔다.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? Date.now;
  }

  async getState(): Promise<AccountResult<AccountState>> {
    const auth = await this.ensureTokens();
    if (!auth.ok) return auth;
    return { ok: true, value: { kind: "guest", provider: "guest", maskedId: `GUEST-${auth.value.userId.slice(0, 4)}••••` } };
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
    this.tokens = null;
    try { await this.options.store.clear(); } catch { return fail("network-error", t("error.account.logoutFailed")); }
    return this.getState();
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
      return fail("network-error", err?.message ?? t("error.account.requestFailed", { status: res.status }));
    } catch {
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
    if (!r.ok) { this.tokens = null; await this.options.store.clear(); }
    return r;
  }

  private async authCall(path: string, body: string): Promise<AccountResult<StoredTokens>> {
    const res = await this.fetchImpl(`${this.options.url}${path}`, {
      method: "POST", headers: { apikey: this.options.key, "Content-Type": "application/json" }, body,
    });
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      this.failure = `auth:${path.split("?")[0]}:${res.status}:${typeof j?.error_code === "string" ? j.error_code : "-"}`;
      // 서버에서 익명 가입이 꺼져 있으면 게스트 계정을 만들 수 없다 — 실패를 성공으로 꾸미지 않는다.
      if (j?.error_code === "anonymous_provider_disabled" || j?.error_code === "signup_disabled") return fail("unsupported", t("error.account.guestDisabled"));
      return fail("network-error", t("error.account.authFailed", { status: res.status }));
    }
    const user = j?.user as { id?: string } | undefined;
    if (typeof j?.access_token !== "string" || typeof j?.refresh_token !== "string" || typeof user?.id !== "string") {
      return fail("network-error", t("error.account.authResponse"));
    }
    const expiresAt = typeof j.expires_at === "number" ? j.expires_at * 1000 : this.now() + (Number(j.expires_in) || 3600) * 1000;
    return { ok: true, value: { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAtMs: expiresAt, userId: user.id } };
  }

  private unsupported<T>(): AccountResult<T> { return fail("unsupported", t("error.account.loginUnsupported")); }
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
