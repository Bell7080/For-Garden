/**
 * 백엔드(Supabase) 연결 확인 — 뼈대 단계의 유일한 호출이다.
 * 인증 토큰을 다루지 않고 공개 키만 쓰며, 설정이 없는 빌드는 성공을 흉내 내지 않고 `unsupported`를 돌려준다.
 */
export type BackendPingResult =
  | { ok: true; serverNow: string; authenticated: boolean }
  | { ok: false; code: "unsupported" | "network-error" };

export async function pingBackend(
  fetchImpl: typeof fetch = fetch,
  url: string | undefined = import.meta.env?.VITE_SUPABASE_URL,
  key: string | undefined = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY,
): Promise<BackendPingResult> {
  if (!url || !key) return { ok: false, code: "unsupported" };
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/ping`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return { ok: false, code: "network-error" };
    const body = (await res.json()) as { ok?: boolean; server_now?: string; authenticated?: boolean };
    if (body.ok !== true || typeof body.server_now !== "string") return { ok: false, code: "network-error" };
    return { ok: true, serverNow: body.server_now, authenticated: body.authenticated === true };
  } catch {
    return { ok: false, code: "network-error" };
  }
}
