import { describe, expect, it, vi } from "vitest";
import { loadOwnedPuppetWithRetry } from "../../src/puppets/ownedPuppetLoad";
import { loadSharedPromise } from "../../src/puppets/promiseCache";

/** Phaser 없이 실제 요청 횟수와 단일 소유권만 세는 전투 Puppet 대역이다. */
function puppet() { return { active: true, destroy: vi.fn() }; }

describe("battle owned Puppet retry boundary", () => {
  it("실패 Promise가 캐시에서 제거된 뒤 전투 호출부가 spawn을 실제로 다시 요청한다", async () => {
    const cache = new Map<string, Promise<ReturnType<typeof puppet>>>();
    const root = puppet();
    const fetchAsset = vi.fn().mockRejectedValueOnce(new Error("temporary upload failure")).mockResolvedValueOnce(root);
    const spawn = vi.fn(() => loadSharedPromise(cache, "fighter.zip", fetchAsset));
    const adopt = vi.fn();

    const result = await loadOwnedPuppetWithRetry({ spawn, isCurrent: () => true, isDisplayable: ({ active }) => active, adopt, attempts: 2, wait: async () => Promise.resolve() });

    expect(result).toEqual({ status: "adopted" });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(fetchAsset).toHaveBeenCalledTimes(2);
  });

  it("재시도 성공 결과는 view에 정확히 한 번만 등록한다", async () => {
    const root = puppet();
    const spawn = vi.fn().mockRejectedValueOnce(new Error("first failure")).mockResolvedValue(root);
    const registerView = vi.fn();

    await expect(loadOwnedPuppetWithRetry({ spawn, isCurrent: () => true, isDisplayable: ({ active }) => active, adopt: registerView, attempts: 3, wait: async () => undefined })).resolves.toEqual({ status: "adopted" });

    expect(registerView).toHaveBeenCalledTimes(1);
    expect(registerView).toHaveBeenCalledWith(root);
    expect(root.destroy).not.toHaveBeenCalled();
  });

  it("Scene 종료 후 늦게 완료된 결과는 등록하지 않고 정확히 한 번 폐기한다", async () => {
    const root = puppet(); let current = true; let resolve!: (value: typeof root) => void;
    const pending = new Promise<typeof root>((done) => { resolve = done; });
    const registerView = vi.fn();
    const loading = loadOwnedPuppetWithRetry({ spawn: () => pending, isCurrent: () => current, isDisplayable: ({ active }) => active, adopt: registerView });

    current = false;
    resolve(root);

    await expect(loading).resolves.toEqual({ status: "discarded", reason: "stale" });
    expect(registerView).not.toHaveBeenCalled();
    expect(root.destroy).toHaveBeenCalledTimes(1);
  });
});
