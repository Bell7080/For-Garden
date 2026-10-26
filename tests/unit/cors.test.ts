import { describe, expect, it } from "vitest";
import { allowedOrigins, applyCors } from "../../src/server/cors";

function fake(method: string, origin?: string) {
  const headers: Record<string, string> = {};
  let status = 0;
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status(n: number) { status = n; return res; }, json() {} };
  const done = applyCors({ method, headers: origin ? { origin } : {} }, res, allowedOrigins("https://stage.example/ , *"));
  return { headers, done, get status() { return status; } };
}

describe("앱 출처 CORS", () => {
  it("허용 출처는 그대로 되돌려 주고 자격 증명 모드는 열지 않는다", () => {
    const r = fake("POST", "capacitor://localhost");
    expect(r.headers["access-control-allow-origin"]).toBe("capacitor://localhost");
    expect(r.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(r.done).toBe(false);
  });
  it("모르는 출처와 와일드카드는 헤더를 달지 않는다", () => {
    expect(fake("POST", "https://evil.example").headers["access-control-allow-origin"]).toBeUndefined();
    expect(allowedOrigins("*")).not.toContain("*");
  });
  it("환경변수로 더한 출처도 허용하고 사전 요청은 204로 끝낸다", () => {
    const r = fake("OPTIONS", "https://stage.example");
    expect(r.headers["access-control-allow-origin"]).toBe("https://stage.example");
    expect(r.done).toBe(true);
    expect(r.status).toBe(204);
  });
});
