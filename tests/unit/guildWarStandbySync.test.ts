import { afterEach, describe, expect, it, vi } from "vitest";

const sync = vi.fn<() => Promise<{ synced: boolean }>>();
vi.mock("../../src/api/FakeServer", () => ({ gameApi: { syncGuildWarStandby: () => sync() } }));

const { syncGuildWarStandby, resetGuildWarStandbySyncForTest } = await import("../../src/managers/GuildWarStandbySync");

describe("길드전 대기 방어덱 동기화", () => {
  afterEach(() => { sync.mockReset(); resetGuildWarStandbySyncForTest(); });

  it("길드가 없어 넣지 못한 날은 가입한 뒤 다시 넣는다", async () => {
    // 예전에는 부르기 전에 그날을 적어 두어, 로비에서 길드 없이 실패하면 그날 가입한 길드원은 자동 배치에서 빠졌다.
    sync.mockResolvedValueOnce({ synced: false }).mockResolvedValueOnce({ synced: true });
    const day = Date.UTC(2026, 10, 1, 3);
    expect(await syncGuildWarStandby(day)).toBe(false);
    expect(await syncGuildWarStandby(day + 120_000)).toBe(true);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("넣은 날은 다시 부르지 않고, 실패는 잠깐 쉬었다 다시 넣는다", async () => {
    sync.mockResolvedValueOnce({ synced: false }).mockResolvedValue({ synced: true });
    const day = Date.UTC(2026, 10, 1, 3);
    await syncGuildWarStandby(day);
    expect(await syncGuildWarStandby(day + 1_000)).toBe(false);
    expect(sync).toHaveBeenCalledTimes(1);
    await syncGuildWarStandby(day + 90_000);
    await syncGuildWarStandby(day + 200_000);
    expect(sync).toHaveBeenCalledTimes(2);
    // 강제로 넣으면 같은 날에도 다시 넣는다(칸이 없을 때 길드전 화면이 부른다).
    await syncGuildWarStandby(day + 300_000, true);
    expect(sync).toHaveBeenCalledTimes(3);
  });
});
