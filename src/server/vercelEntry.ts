/** 인증된 본인의 게임·친구 상태만 조작하는 HTTP 경계. */
import { GameCallError, handleGameCall } from "./gameHandler";
import { createSupabaseStore } from "./supabaseStore";
import { isServerGameMethod } from "./gameMethods";
import { isSocialMethod } from "../api/RemoteSocialApi";
import { GuildApiError, isGuildApiMethod, type GuildBackend } from "../api/guildContracts";
import { guildActorFrom } from "../api/guildActor";
import { createSupabaseGuildBackend } from "../api/SupabaseGuildBackend";
import { saveManager } from "../state/SaveManager";
import { createDefaultSession } from "../state/session";
import { isReadMethod, MAX_BODY_BYTES, validCall } from "./requestPolicy";

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status(code: number): Res; json(body: unknown): void; setHeader(k: string, v: string): void }

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") { res.setHeader("allow","POST"); res.status(405).json({ ok: false, code: "method_not_allowed" }); return; }
  try {
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null);
    if (Number(req.headers["content-length"] ?? 0)>MAX_BODY_BYTES || new TextEncoder().encode(raw).length>MAX_BODY_BYTES) throw new GameCallError(413,"body_too_large");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new GameCallError(400,"invalid_json"); }
    if (!validCall(body)) throw new GameCallError(400,"invalid_request");
    if (!isServerGameMethod(body.method) && !(body.method.startsWith("social.") && isSocialMethod(body.method.slice(7))) && !(body.method.startsWith("guild.") && isGuildApiMethod(body.method.slice(6)))) throw new GameCallError(400,"unknown_method");
    if (!isReadMethod(body.method) && !body.requestId) throw new GameCallError(400,"request_id_required");
    const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? serviceKey;
    if (!url || !serviceKey) throw new GameCallError(503,"server_not_configured");
    const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    if (!/^Bearer \S+$/.test(auth)) throw new GameCallError(401,"not_authenticated");
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey ?? "", authorization: auth }, signal: AbortSignal.timeout(10000) });
    const user = who.ok ? await who.json() as { id?: string } : null;
    if (!user?.id) throw new GameCallError(401,"not_authenticated");
    const store = createSupabaseStore({ url, serviceKey });
    const rate = await store.takeRate(user.id,body.method);
    if (!rate.allowed) { res.setHeader("retry-after",String(rate.retryAfter)); throw new GameCallError(429,"rate_limited"); }
    const uid = user.id;
    const guild: GuildBackend = createSupabaseGuildBackend(async (actor, method, args, requestId) => store.guildCall(uid, method, actor, args, requestId));
    if (body.method.startsWith("guild.")) {
      const method = body.method.slice(6);
      if (!isGuildApiMethod(method)) throw new GameCallError(400,"unknown_method");
      // 호출자(이름·레벨·얼굴)는 저장된 진행에서 서버가 만든다 — 클라이언트의 말을 쓰지 않는다.
      const stored = await store.load(user.id);
      const actor = guildActorFrom(stored ? saveManager.parse(stored.data) : createDefaultSession(), user.id);
      try {
        const result = await (guild[method] as (...a: unknown[]) => Promise<unknown>)(actor, ...(body.args ?? []));
        res.status(200).json({ ok: true, result: result ?? null });
      } catch (error) {
        if (error instanceof GuildApiError) throw new GameCallError(422, error.code, error.message);
        throw error;
      }
    } else if (body.method.startsWith("social.")) {
      const method=body.method.slice(7);
      if (!isSocialMethod(method)) throw new GameCallError(400,"unknown_method");
      res.status(200).json(await store.socialCall(user.id,method,body.args??[],body.requestId));
    } else {
      res.status(200).json(await handleGameCall(user.id,body,{store,strict:true,guild}));
    }
  } catch (error) {
    if (error instanceof GameCallError) { res.status(error.status).json({ ok:false,code:error.code,message:error.message }); return; }
    res.status(503).json({ ok:false,code:"service_unavailable" });
  }
}
