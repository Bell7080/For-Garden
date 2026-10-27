/**
 * 앱(Capacitor WebView) 출처의 교차 출처 호출을 허용하는 경계다. 인증은 Bearer 토큰이라 쿠키·자격
 * 증명 모드는 열지 않고, 허용 목록에 있는 출처만 그대로 되돌려 준다(`*`를 쓰지 않는다).
 * 웹 빌드는 같은 출처라 이 헤더가 필요 없다. 추가 출처(스테이징 등)는 환경변수로 더한다.
 */
export const APP_ORIGINS: readonly string[] = [
  "capacitor://localhost", // iOS
  "https://localhost", // Android (androidScheme: https)
  "ionic://localhost",
];

interface CorsReq { method?: string; headers: Record<string, string | string[] | undefined> }
interface CorsRes { status(code: number): CorsRes; setHeader(k: string, v: string): void; end?(): void; json(body: unknown): void }

export function allowedOrigins(extra: string | undefined = process.env.CORS_ALLOWED_ORIGINS): string[] {
  const more = (extra ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter((o) => o !== "" && o !== "*");
  return [...APP_ORIGINS, ...more];
}

/** 헤더를 달고, 사전 요청(OPTIONS)이면 응답까지 끝낸 뒤 true를 돌려준다. */
export function applyCors(req: CorsReq, res: CorsRes, origins: readonly string[] = allowedOrigins()): boolean {
  res.setHeader("vary", "Origin");
  const origin = req.headers.origin;
  if (typeof origin === "string" && origins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-max-age", "600");
  }
  if (req.method !== "OPTIONS") return false;
  res.status(204).json(null);
  return true;
}
