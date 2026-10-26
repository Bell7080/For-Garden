import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl } from "../../src/core/apiBase";
import { applyApiOriginPolicy } from "../../src/server/httpSecurity";

afterEach(() => vi.unstubAllEnvs());

describe("병합 후 앱 API와 보안 경계", () => {
  it("메인의 API 주소 설정도 HTTPS 검증을 거쳐 사용한다", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://game.example/");
    expect(apiUrl("/api/game")).toBe("https://game.example/api/game");
    expect(() => apiUrl("/api/account", "http://game.example")).toThrow("INVALID_API_ORIGIN");
  });
  it("기존 네이티브 설정 이름도 지원한다", () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    vi.stubEnv("VITE_GAME_API_ORIGIN", "https://native.example");
    expect(apiUrl("/api/account")).toBe("https://native.example/api/account");
  });
  it.each(["capacitor://localhost", "https://localhost", "https://stage.example"])("실제 HTTP 경계가 메인의 허용 출처 %s를 처리한다", origin => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://stage.example");
    const headers: Record<string, string> = {};
    const res = { code: 0, status(code: number) { this.code = code; return this; }, json: vi.fn(), end: vi.fn(), setHeader(k: string, v: string) { headers[k] = v; } };
    expect(applyApiOriginPolicy({ method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "Authorization, Content-Type" } }, res)).toBe(true);
    expect(res.code).toBe(204);
    expect(headers["access-control-allow-origin"]).toBe(origin);
    expect(headers["access-control-allow-credentials"]).toBeUndefined();
    expect(headers["cache-control"]).toBe("no-store");
  });
});
