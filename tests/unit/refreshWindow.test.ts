import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshWindow } from "../../src/server/refreshWindow";

afterEach(() => vi.useRealTimers());
describe("보상 정산 갱신", () => {
  it("같은 계정의 겹친 정산은 한 번만 실행하고 성공 후에만 1분을 센다", async () => {
    vi.useFakeTimers();
    const refresh = refreshWindow(60_000);
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = refresh("prod:player-a", task);
    const second = refresh("prod:player-a", task);
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
    finish(); await Promise.all([first, second]);
    await refresh("prod:player-a", task);
    expect(task).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_001);
    const next = vi.fn(async () => undefined);
    await refresh("prod:player-a", next);
    expect(next).toHaveBeenCalledOnce();
  });
  it("실패는 캐시하지 않고 다른 프로젝트와 계정은 분리한다", async () => {
    const refresh = refreshWindow(60_000);
    const failed = vi.fn(async () => { throw Error("upstream"); });
    await expect(refresh("prod:a", failed)).rejects.toThrow("upstream");
    const task = vi.fn(async () => undefined);
    await refresh("prod:a", task);
    await refresh("test:a", task);
    await refresh("prod:b", task);
    expect(task).toHaveBeenCalledTimes(3);
  });
});
