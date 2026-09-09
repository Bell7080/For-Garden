import { describe, expect, it, vi } from "vitest";
import { loadOwnedPuppetWithRetry } from "../../src/puppets/ownedPuppetLoad";
import { loadSharedPromise } from "../../src/puppets/promiseCache";
import { reportBattleFighterFallbackFailure } from "../../src/debug";

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

  it("첫 준비와 재시도를 구분하고 최종 실패만 실패 상태로 게시한다", async () => {
    const states: string[] = [];
    // 화면은 오류 원문 대신 이 세 단계만 받아 진영 표식의 표현을 결정한다.
    const result = await loadOwnedPuppetWithRetry<ReturnType<typeof puppet>>({
      spawn: vi.fn().mockRejectedValue(new Error("private transport detail")),
      isCurrent: () => true,
      isDisplayable: ({ active }) => active,
      adopt: vi.fn(),
      attempts: 3,
      wait: async () => undefined,
      onStateChange: (state) => states.push(state),
    });

    expect(result).toEqual(expect.objectContaining({ status: "failed", attempts: 3 }));
    expect(states).toEqual(["loading", "retrying", "retrying", "failed"]);
  });

  it("모든 재시도 실패의 fighter·asset·횟수·원래 오류를 구조화해 보존한다", () => {
    const failure = new Error("private decoder detail");
    const host = globalThis as typeof globalThis & { __PF_DEBUG?: { battleFighterDiagnostics?: unknown[] } };
    host.__PF_DEBUG = undefined;

    reportBattleFighterFallbackFailure({ fighterId: "ally:rex", assetUrl: "rex-sd.zip", retryCount: 2, error: failure });

    // Error를 문자열로 바꾸지 않아 개발 진단에서 원래 stack과 cause를 계속 확인할 수 있다.
    expect((globalThis as typeof globalThis & { __PF_DEBUG?: { battleFighterDiagnostics?: unknown[] } }).__PF_DEBUG?.battleFighterDiagnostics).toEqual([{
      fighterId: "ally:rex", assetUrl: "rex-sd.zip", retryCount: 2, error: failure,
    }]);
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
