import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../../src/server/vercelEntry";
function response() {
  const out = {
    code: 0,
    body: {} as Record<string, unknown>,
    headers: {} as Record<string, string>,
  };
  const res = {
    status(code: number) {
      out.code = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      out.body = body;
    },
    setHeader(k: string, v: string) {
      out.headers[k] = v;
    },
  };
  return { out, res };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function configured() {
  vi.stubEnv("SUPABASE_URL", "https://db.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key");
}
describe("인증·속도 제한·개발 진입점 HTTP 경계", () => {
  it.each([
    null,
    [],
    { method: "constructor" },
    { method: "__PF_DEBUG" },
    { method: "getInventory", args: {} },
    { method: "getInventory", requestId: 1 },
  ])("잘못된 요청은 DB를 호출하기 전에 거절한다: %j", async (body) => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { out, res } = response();
    await handler({ method: "POST", headers: {}, body }, res);
    expect(out.code).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("본문 크기와 쓰기 requestId를 강제한다", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const large = response();
    await handler(
      { method: "POST", headers: {}, body: "x".repeat(131073) },
      large.res,
    );
    expect(large.out.code).toBe(413);
    const write = response();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { method: "finishCombat", args: [] },
      },
      write.res,
    );
    expect(write.out.body.code).toBe("request_id_required");
    expect(f).not.toHaveBeenCalled();
  });
  it("토큰·DB 계정 제한이 통과해야 호출 예산을 확인하고 초과하면 Retry-After와 429를 돌려준다", async () => {
    configured();
    const f = vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url).includes("auth/v1/user")
              ? { id: "real-player" }
              : { allowed: false, retryAfter: 31 },
          ),
        ),
    );
    vi.stubGlobal("fetch", f);
    const { out, res } = response();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer test-token" },
        body: { method: "getInventory" },
      },
      res,
    );
    expect(out.code).toBe(429);
    expect(out.headers["retry-after"]).toBe("31");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("친구 조회의 주체는 요청 본문이 아닌 검증된 JWT의 계정이다", async () => {
    configured();
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const f = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : {},
      });
      return new Response(
        JSON.stringify(
          String(url).includes("auth/v1/user")
            ? { id: "real-player" }
            : String(url).includes("server_take_rate")
              ? { allowed: true }
              : { ok: true, result: { friends: [] }, incomingCount: 0 },
        ),
      );
    });
    vi.stubGlobal("fetch", f);
    const { out, res } = response();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer test-token" },
        body: {
          method: "social.getFriends",
          args: [],
          playerId: "another-player",
        },
      },
      res,
    );
    expect(out.code).toBe(200);
    expect(calls.at(-1)?.body.p_player).toBe("real-player");
    expect(calls.at(-1)?.body.p_method).toBe("getFriends");
  });
  it("Auth 통신 실패 시 내부 예외와 서버 키를 응답에 노출하지 않는다", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("private upstream details");
      }),
    );
    const { out, res } = response();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: { method: "getInventory" },
      },
      res,
    );
    expect(out.code).toBe(503);
    expect(JSON.stringify(out.body)).not.toContain("private");
    expect(JSON.stringify(out.body)).not.toContain("test-server-only-key");
  });
});
