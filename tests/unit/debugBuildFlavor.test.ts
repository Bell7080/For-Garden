import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.doUnmock("../../src/core/buildFlavor"); vi.resetModules(); vi.unstubAllGlobals(); });

async function debugFor(qa: boolean, search = "") {
  vi.doMock("../../src/core/buildFlavor", () => ({ QA_TOOLS_ENABLED: qa }));
  vi.stubGlobal("window", {});
  vi.stubGlobal("location", { search });
  vi.stubGlobal("__PF_BUILD_COMMIT__", "unit-build");
  return import("../../src/debug");
}

describe("일반 빌드 디버그 차단", () => {
  it("perf 옵션이 있어도 모든 관측 함수가 전역·DOM·세션 정보를 만들지 않는다", async () => {
    const debug = await debugFor(false, "?perf=1");
    const documentAccess = vi.fn(() => { throw new Error("production debug touched DOM"); });
    vi.stubGlobal("document", { getElementById: documentAccess });
    // 인자 없이도 즉시 끝나야 한다. 배열 복사나 좌표 계산 전에 빌드 가드가 실행되는지 검증한다.
    for (const value of Object.values(debug)) if (typeof value === "function") (value as () => void)();
    expect(debug.debugPerfEnabled).toBe(false);
    expect(window.__PF_DEBUG).toBeUndefined();
    expect(documentAccess).not.toHaveBeenCalled();
  });

  it("QA에서는 기존 씬·지갑 관측 계약을 유지한다", async () => {
    const debug = await debugFor(true);
    debug.setDebugScene("lobby", "로비"); debug.setDebugReady(true);
    const wallet = { fossil: 900, amber: 450 }; const owned = new Set(["torika"]);
    debug.setDebugProgress(wallet, owned); wallet.fossil = 0; owned.clear();
    expect(window.__PF_DEBUG).toMatchObject({ build: { commit: "unit-build" }, scene: "lobby", ready: true, wallet: { fossil: 900, amber: 450 }, owned: ["torika"] });
    expect(debug.debugPerfEnabled).toBe(false);
  });

  it("QA에서만 명시적인 perf 옵션으로 측정을 켠다", async () => {
    const debug = await debugFor(true, "?perf=1");
    expect(debug.debugPerfEnabled).toBe(true);
  });
});
