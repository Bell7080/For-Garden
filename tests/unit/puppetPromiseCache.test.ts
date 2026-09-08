import { describe, expect, it, vi } from "vitest";
import { loadSharedPromise } from "../../src/puppets/promiseCache";

describe("Puppet Promise cache boundary", () => {
  it("첫 로드 실패를 캐시에서 제거해 다음 요청은 새 로더로 성공한다", async () => {
    const cache = new Map<string, Promise<string>>();
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("temporary ZIP failure"))
      .mockResolvedValueOnce("parsed puppet");

    // reject 처리의 microtask까지 기다린 뒤 두 번째 호출이 실패 Promise를 재사용하지 않는지 고정한다.
    await expect(loadSharedPromise(cache, "puppet.zip", loader)).rejects.toThrow("temporary ZIP failure");
    await expect(loadSharedPromise(cache, "puppet.zip", loader)).resolves.toBe("parsed puppet");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("동시에 들어온 요청은 캐시에 먼저 들어간 하나의 Promise와 로더 호출을 공유한다", async () => {
    const cache = new Map<string, Promise<string>>();
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((done) => { resolve = done; }));

    // 첫 작업이 진행 중이어도 두 번째 요청용 작업을 만들지 않는 동시성 계약이다.
    const first = loadSharedPromise(cache, "puppet.zip", loader);
    const second = loadSharedPromise(cache, "puppet.zip", loader);
    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
    resolve("parsed puppet");
    await expect(Promise.all([first, second])).resolves.toEqual(["parsed puppet", "parsed puppet"]);
  });
});
