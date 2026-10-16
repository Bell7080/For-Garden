/**
 * Vercel 함수 진입점이다. `scripts/build-server.mjs`가 이 파일을 `api/game.js` 한 장으로 묶는다.
 * 사용자 JWT는 Supabase Auth에 물어 확인하고(`/auth/v1/user`), 그 id로만 상태를 읽고 쓴다.
 */
import { GameCallError, handleGameCall } from "./gameHandler";
import { createSupabaseStore } from "./supabaseStore";

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status(code: number): Res; json(body: unknown): void; setHeader(k: string, v: string): void }

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ ok: false, code: "method_not_allowed" }); return; }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? serviceKey;
  if (!url || !serviceKey) { res.status(503).json({ ok: false, code: "server_not_configured" }); return; }
  const auth = String(req.headers.authorization ?? "");
  if (!auth.startsWith("Bearer ")) { res.status(401).json({ ok: false, code: "not_authenticated" }); return; }
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey ?? "", authorization: auth } });
  const user = who.ok ? ((await who.json()) as { id?: string }) : null;
  if (!user?.id) { res.status(401).json({ ok: false, code: "not_authenticated" }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const out = await handleGameCall(user.id, body as never, { store: createSupabaseStore({ url, serviceKey }) });
    res.status(200).json(out);
  } catch (error) {
    if (error instanceof GameCallError) { res.status(error.status).json({ ok: false, code: error.code, message: error.message }); return; }
    res.status(500).json({ ok: false, code: "internal" });
  }
}
