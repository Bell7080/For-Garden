/**
 * 로그인 토큰을 서버 안에서 확인한다(Supabase 비대칭 서명 키 · JWKS).
 *
 * 예전에는 호출마다 `auth/v1/user`로 한 번 왕복했다. 보통은 20ms 안팎이지만 DB가 붐비면 같은 DB를 읽는
 * 그 왕복도 함께 느려져 상위 1%가 3초를 넘었다(2026-11-19 실측, 최대 9.6초). 서명·만료·발급자를 여기서
 * 확인하면 그 왕복이 사라진다. 차단·삭제된 계정은 저장을 읽는 단계(`server_load_state`의 상태 확인)가
 * 그대로 막는다.
 *
 * 확인할 수 없는 경우(키를 못 받음, 모르는 서명 방식·발급자)에는 `undefined`를 돌려 부르는 쪽이 예전 왕복으로
 * 되돌아간다. 알고 있는 키로 서명이 틀렸거나 만료된 토큰만 `null`(거절)이다.
 */

export interface VerifiedUser { id: string }

interface Jwk { kid?: string; kty?: string; crv?: string; alg?: string; x?: string; y?: string; n?: string; e?: string }

const JWKS_TTL_MS = 10 * 60_000;
/** 서명 키가 바뀐 직후 모르는 kid가 오면 다시 받는다 — 같은 kid로 매번 받지 않게 간격을 둔다. */
const JWKS_REFETCH_GAP_MS = 30_000;
/** 기기 시계 차이로 막 발급된 토큰이 거절되지 않게 둔 여유. */
const CLOCK_SKEW_S = 30;

interface KeyCache { at: number; keys: Map<string, CryptoKey> }
const caches = new Map<string, KeyCache>();
const lastFetchAt = new Map<string, number>();

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function base64UrlJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function algorithmOf(alg: string): { import: EcKeyImportParams | RsaHashedImportParams; verify: EcdsaParams | AlgorithmIdentifier } | null {
  if (alg === "ES256") return { import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" } };
  if (alg === "RS256") return { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } };
  return null;
}

async function loadKeys(url: string, fetcher: typeof fetch, signal?: AbortSignal): Promise<Map<string, CryptoKey> | null> {
  lastFetchAt.set(url, Date.now());
  const response = await fetcher(`${url}/auth/v1/.well-known/jwks.json`, { signal });
  if (!response.ok) return null;
  const body = await response.json() as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    const alg = jwk.alg ?? (jwk.kty === "EC" ? "ES256" : jwk.kty === "RSA" ? "RS256" : "");
    const spec = algorithmOf(alg);
    if (!jwk.kid || !spec) continue;
    try {
      keys.set(`${jwk.kid}:${alg}`, await crypto.subtle.importKey("jwk", jwk as JsonWebKey, spec.import, false, ["verify"]));
    } catch {
      // 읽지 못한 키 하나가 나머지를 막지 않는다.
    }
  }
  caches.set(url, { at: Date.now(), keys });
  return keys;
}

async function keyFor(url: string, kid: string, alg: string, fetcher: typeof fetch, signal?: AbortSignal): Promise<CryptoKey | undefined> {
  const cached = caches.get(url);
  const fresh = cached && Date.now() - cached.at < JWKS_TTL_MS ? cached.keys : null;
  const hit = fresh?.get(`${kid}:${alg}`);
  if (hit) return hit;
  if (fresh && Date.now() - (lastFetchAt.get(url) ?? 0) < JWKS_REFETCH_GAP_MS) return undefined;
  const keys = await loadKeys(url, fetcher, signal).catch(() => null);
  if (!keys) return undefined;
  return keys.get(`${kid}:${alg}`);
}

/**
 * `Bearer` 토큰을 확인한다. 통과하면 사용자, 서명·만료·발급자가 틀리면 `null`, 여기서 판단할 수 없으면 `undefined`.
 */
export async function verifyAccessToken(
  url: string,
  token: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; nowSeconds?: number } = {},
): Promise<VerifiedUser | null | undefined> {
  const base = url.replace(/\/+$/, "");
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const header = base64UrlJson(parts[0]);
  const payload = base64UrlJson(parts[1]);
  if (!header || !payload) return undefined;
  const alg = typeof header.alg === "string" ? header.alg : "";
  const kid = typeof header.kid === "string" ? header.kid : "";
  const spec = algorithmOf(alg);
  // 예전 대칭키(HS256) 토큰이나 kid 없는 토큰은 여기서 확인할 키가 없다 — 예전 왕복으로 되돌린다.
  if (!spec || !kid) return undefined;
  const key = await keyFor(base, kid, alg, options.fetcher ?? fetch, options.signal);
  if (!key) return undefined;
  let signature: Uint8Array<ArrayBuffer>;
  try { signature = base64UrlBytes(parts[2]); } catch { return null; }
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(spec.verify, key, signature, signed).catch(() => false);
  if (!valid) return null;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_S > now) return null;
  // 서명은 맞는데 발급자·역할이 예상과 다르면(사용자 지정 도메인 등) 여기서 거절하지 않고 예전 왕복에 맡긴다.
  if (payload.iss !== `${base}/auth/v1`) return undefined;
  if (payload.role !== "authenticated") return undefined;
  const aud = payload.aud;
  if (aud !== undefined && aud !== "authenticated" && !(Array.isArray(aud) && aud.includes("authenticated"))) return undefined;
  return typeof payload.sub === "string" && payload.sub.length > 0 ? { id: payload.sub } : undefined;
}

/** 테스트에서 키 캐시를 비운다. */
export function resetJwksCache(): void {
  caches.clear();
  lastFetchAt.clear();
}
