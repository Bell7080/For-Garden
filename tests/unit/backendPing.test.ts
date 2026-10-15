import { describe, expect, it } from "vitest";
import { pingBackend } from "../../src/api/backendPing";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("pingBackend", () => {
  it("설정이 없으면 unsupported", async () => {
    expect(await pingBackend(fetch, undefined, undefined)).toEqual({ ok: false, code: "unsupported" });
  });
  it("정상 응답을 해석한다", async () => {
    const f = (async () => json({ ok: true, server_now: "2026-10-15T00:00:00Z", authenticated: false })) as typeof fetch;
    expect(await pingBackend(f, "https://x", "k")).toEqual({ ok: true, serverNow: "2026-10-15T00:00:00Z", authenticated: false });
  });
  it("오류와 예외는 network-error", async () => {
    expect(await pingBackend((async () => json({}, 500)) as typeof fetch, "https://x", "k")).toEqual({ ok: false, code: "network-error" });
    expect(await pingBackend((async () => { throw new Error("x"); }) as typeof fetch, "https://x", "k")).toEqual({ ok: false, code: "network-error" });
  });
});
