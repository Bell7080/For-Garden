import { describe, expect, it } from "vitest";
import { compareVersions, configGate, fetchPublicConfig, type PublicConfig } from "../../src/api/backendConfig";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const base: PublicConfig = { maintenance: false, maintenanceMessage: "", maintenanceEndsAt: null, minAppVersion: "", latestAppVersion: "", launchEpoch: "" };

describe("fetchPublicConfig", () => {
  it("설정이 없으면 unsupported", async () => {
    expect(await fetchPublicConfig(fetch, undefined, undefined)).toEqual({ ok: false, code: "unsupported" });
  });
  it("DB 응답 필드를 해석한다", async () => {
    const f = (async () =>
      json({ maintenance: true, message: "점검", ends_at: "2026-10-20T00:00:00Z", min_version: "0.286.0", latest_version: "0.287.0", launch_epoch: "20261101T000000-ab12cd34" })) as typeof fetch;
    expect(await fetchPublicConfig(f, "https://x", "k")).toEqual({
      ok: true,
      config: { maintenance: true, maintenanceMessage: "점검", maintenanceEndsAt: "2026-10-20T00:00:00Z", minAppVersion: "0.286.0", latestAppVersion: "0.287.0", launchEpoch: "20261101T000000-ab12cd34" },
    });
  });
  it("형식이 틀린 응답과 예외는 network-error", async () => {
    expect(await fetchPublicConfig((async () => json({})) as typeof fetch, "https://x", "k")).toEqual({ ok: false, code: "network-error" });
    expect(await fetchPublicConfig((async () => json({}, 500)) as typeof fetch, "https://x", "k")).toEqual({ ok: false, code: "network-error" });
    expect(await fetchPublicConfig((async () => { throw new Error("x"); }) as typeof fetch, "https://x", "k")).toEqual({ ok: false, code: "network-error" });
  });
});

describe("configGate", () => {
  it("버전을 숫자로 비교한다", () => {
    expect(compareVersions("0.9.0", "0.10.0")).toBe(-1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.286.0", "0.285.9")).toBe(1);
  });
  it("점검이 업데이트보다 먼저다", () => {
    expect(configGate({ ...base, maintenance: true, minAppVersion: "9.0.0" }, "0.1.0")).toBe("maintenance");
    expect(configGate({ ...base, minAppVersion: "0.286.0" }, "0.285.1")).toBe("update-required");
    expect(configGate({ ...base, minAppVersion: "0.286.0" }, "0.286.0")).toBe("open");
    expect(configGate(base, "0.1.0")).toBe("open");
  });
});
