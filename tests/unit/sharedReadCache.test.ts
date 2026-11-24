import { afterEach, describe, expect, it, vi } from "vitest";
import { sharedReadCache } from "../../src/server/sharedReadCache";
import { createSupabaseStore } from "../../src/server/supabaseStore";

afterEach(() => { vi.useRealTimers(); });
describe("운영 정의 공유 조회", () => {
  it("동시 요청은 한 번만 읽고 성공한 값은 TTL 뒤 다시 읽는다", async () => {
    vi.useFakeTimers();
    const cache = sharedReadCache<number>(60_000);
    const load = vi.fn(async () => 1);
    await expect(Promise.all(Array.from({ length: 4 }, () => cache.read("prod", load)))).resolves.toEqual([1, 1, 1, 1]);
    await cache.read("prod", load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    await cache.read("prod", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("갱신 실패는 캐시하지 않고 이전 값은 보존한다", async () => {
    vi.useFakeTimers();
    const cache = sharedReadCache<number>(60_000);
    await cache.read("prod", async () => 1);
    vi.advanceTimersByTime(60_000);
    await expect(cache.read("prod", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(cache.peek("prod")).toBe(1);
    await expect(cache.read("prod", async () => 2)).resolves.toBe(2);
  });
  it("저장소 인스턴스가 4개여도 같은 프로젝트의 운영 일정·출시 시각은 각각 한 번만 읽는다", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith("server_launch_at") ? "2026-11-24T00:00:00Z" : [])));
    const stores = Array.from({ length: 4 }, () => createSupabaseStore({ url: "https://coalesced-config.test", serviceKey: "k", fetchImpl }));
    await Promise.all(stores.map(async store => { await Promise.all([store.liveSchedule!(), store.launchAt!()]); }));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const qa = createSupabaseStore({ url: "https://isolated-qa.test", serviceKey: "k", fetchImpl: async () => new Response(JSON.stringify("2026-12-01T00:00:00Z")) });
    await expect(qa.launchAt!()).resolves.toBe("2026-12-01T00:00:00Z");
    await expect(stores[0].launchAt!()).resolves.toBe("2026-11-24T00:00:00Z");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
