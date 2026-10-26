interface HttpRequest { method?: string; headers: Record<string, string | string[] | undefined> }
interface HttpResponse { setHeader(k: string, v: string): void; status(n: number): unknown; json(value: unknown): void; end?(): void }

/** CORS는 인증을 대신하지 않는다. 네이티브 WebView의 정확한 Origin만 별도로 허용한다. */
export function applyApiOriginPolicy(req: HttpRequest, res: HttpResponse, configured = process.env.FORGARDEN_APP_ORIGINS ?? ""): boolean {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  const origin = req.headers.origin;
  if (origin === undefined && req.method !== "OPTIONS") return false;
  const host = req.headers.host;
  const sameOrigin = typeof host === "string" ? `https://${host}` : "";
  const allowed = new Set(configured.split(",").map(value => value.trim()).filter(value => value && value !== "*" && value !== "null"));
  if (typeof origin !== "string" || origin === "null" || !(origin === sameOrigin || allowed.has(origin))) {
    res.status(403); res.json({ ok: false, code: "origin_not_allowed" }); return true;
  }
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-origin", origin);
  if (req.method !== "OPTIONS") return false;
  const method = req.headers["access-control-request-method"];
  const requestedHeaders = req.headers["access-control-request-headers"];
  if (method !== "POST" || Array.isArray(requestedHeaders) || (requestedHeaders ?? "").split(",").some(name => name.trim() && !["authorization", "content-type"].includes(name.trim().toLowerCase()))) {
    res.status(403); res.json({ ok: false, code: "preflight_not_allowed" }); return true;
  }
  res.setHeader("access-control-allow-methods", "POST");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  res.setHeader("access-control-max-age", "600");
  res.status(204);
  if (res.end) res.end(); else res.json(null);
  return true;
}

/** 운영 프로젝트에서 QA 환경변수 하나만 잘못 켜도 개발 지급이 열리지 않게 프로젝트를 고정한다. */
export function qaToolsAllowed(url: string, enabled: string | undefined): boolean {
  if (enabled !== "1") return false;
  try { return new URL(url).origin === "https://rscxzfdnbdmftortrcqt.supabase.co"; } catch { return false; }
}
