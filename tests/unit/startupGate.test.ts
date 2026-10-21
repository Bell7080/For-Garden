import { afterEach, describe, expect, it, vi } from "vitest";
import { checkStartupGate } from "../../src/api/startupGate";
afterEach(() => vi.useRealTimers());
describe("인증 전 초기 설정", () => {
  it("ping이 멈춰도 도착한 초기화 세대를 반환한다", async () => {
    const fetchImpl = (async (url: string) => url.endsWith("/ping") ? new Promise<Response>(() => {}) : new Response(JSON.stringify({ maintenance: false, launch_epoch: "E2" }))) as typeof fetch;
    const result = await checkStartupGate("0.324.0", { fetchImpl, url: "https://isolated.test", key: "test", timeoutMs: 50 });
    expect(result.config?.launchEpoch).toBe("E2");
  });
  it("설정 자체가 지연되면 시간 제한 뒤 미확인 결과를 반환하고 다음 요청은 새로 조회한다", async () => {
    vi.useFakeTimers();
    const stalled = checkStartupGate("0.324.0", { fetchImpl: (() => new Promise(() => {})) as typeof fetch, url: "https://isolated.test", key: "test", timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    expect((await stalled).config).toBeNull();
    const result = await checkStartupGate("0.324.0", { fetchImpl: (async () => new Response(JSON.stringify({ maintenance: false, launch_epoch: "E2" }))) as typeof fetch, url: "https://isolated.test", key: "test" });
    expect(result.config?.launchEpoch).toBe("E2");
  });
});
