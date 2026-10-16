import { afterEach, describe, expect, it } from "vitest";
import { resetServerClock, serverClockOffsetMs, serverNow, syncServerClock } from "../../src/api/serverClock";
import { checkStartupGate } from "../../src/api/startupGate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const cfg = (over: Record<string, unknown> = {}) => ({ maintenance: false, message: "", ends_at: null, min_version: "", latest_version: "", ...over });
const route = (config: unknown, ping: unknown = { ok: true, server_now: "2026-10-16T00:00:10Z", authenticated: false }) =>
  (async (input: RequestInfo | URL) => (String(input).includes("get_public_config") ? json(config) : json(ping))) as typeof fetch;

afterEach(() => resetServerClock());

describe("serverClock", () => {
  it("왕복의 가운데 시각과 서버 시각의 차이를 오프셋으로 둔다", () => {
    const base = Date.parse("2026-10-16T00:00:00Z");
    expect(syncServerClock("2026-10-16T00:00:10Z", base, base + 200)).toBe(true);
    expect(serverClockOffsetMs()).toBe(10_000 - 100);
  });
  it("잘못된 시각은 무시하고 기기 시계를 그대로 쓴다", () => {
    expect(syncServerClock("nope", 0, 1)).toBe(false);
    expect(serverClockOffsetMs()).toBe(0);
    expect(Math.abs(serverNow().getTime() - Date.now())).toBeLessThan(50);
  });
});

describe("checkStartupGate", () => {
  const opt = { url: "https://x", key: "k" };
  it("설정이 없으면 막지 않는다", async () => {
    expect(await checkStartupGate("0.1.0", { fetchImpl: route(cfg()), url: undefined, key: undefined })).toMatchObject({ gate: "open" });
  });
  it("점검 중이면 막는다", async () => {
    const r = await checkStartupGate("0.1.0", { ...opt, fetchImpl: route(cfg({ maintenance: true, message: "점검" })) });
    expect(r.gate).toBe("maintenance");
    expect(r.config?.maintenanceMessage).toBe("점검");
  });
  it("최소 버전보다 낮으면 업데이트를 요구한다", async () => {
    expect((await checkStartupGate("0.1.0", { ...opt, fetchImpl: route(cfg({ min_version: "0.2.0" })) })).gate).toBe("update-required");
  });
  it("서버가 응답하면 서버 시계를 맞춘다", async () => {
    await checkStartupGate("0.1.0", { ...opt, fetchImpl: route(cfg()) });
    expect(serverClockOffsetMs()).not.toBe(0);
  });
  it("실패하거나 늦으면 막지 않는다", async () => {
    expect((await checkStartupGate("0.1.0", { ...opt, fetchImpl: (async () => { throw new Error("x"); }) as typeof fetch })).gate).toBe("open");
    const slow = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    expect((await checkStartupGate("0.1.0", { ...opt, fetchImpl: slow, timeoutMs: 20 })).gate).toBe("open");
  });
});
