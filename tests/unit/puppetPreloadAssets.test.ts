import { describe, expect, it, vi } from "vitest";
import {
  ALLY_SD_ASSETS,
  PORTRAIT_ASSETS,
  PUPPET_PRELOAD_GROUPS,
  preloadPuppetAssets,
  type PuppetAsset,
} from "../../src/puppets/assets";
import { runLoadingSteps, type LoadingStep } from "../../src/scenes/loadingStepRunner";

/** 새 캐릭터의 전신/SD 등록이 타이틀 사전 로딩에서 빠지지 않도록 레지스트리 계약을 고정한다. */
describe("Puppet 사전 로딩 레지스트리", () => {
  const preloadedUrls = PUPPET_PRELOAD_GROUPS.flat().map((asset) => asset.url);

  it.each(Object.entries(PORTRAIT_ASSETS))("전신 %s URL을 포함한다", (_id, asset) => {
    expect(preloadedUrls).toContain(asset.url);
  });

  it.each(Object.entries(ALLY_SD_ASSETS))("아군 SD %s URL을 포함한다", (_id, asset) => {
    expect(preloadedUrls).toContain(asset.url);
  });

  it("동일 URL을 한 번만 등록한다", () => {
    // 그룹 경계가 달라도 같은 ZIP을 두 번 요청하지 않는다는 URL 단위 계약이다.
    expect(new Set(preloadedUrls).size).toBe(preloadedUrls.length);
  });

  it("즉시 실패한 에셋이 있어도 지연 요청들이 settle되기 전에는 단계를 완료하지 않는다", async () => {
    // 첫 에셋은 즉시 영구 실패하고 두 번째 에셋은 테스트가 직접 해제할 때까지 성공을 지연한다.
    const template = Object.values(PORTRAIT_ASSETS)[0];
    const assets = [{ ...template, url: "broken.zip" }, { ...template, url: "slow.zip" }] as const;
    let releaseSlow: (() => void) | undefined;
    const slow = new Promise<void>((resolve) => { releaseSlow = resolve; });
    const loader = vi.fn((asset: PuppetAsset) =>
      asset.url === "broken.zip" ? Promise.reject(new Error("broken archive")) : slow,
    );
    const done: number[] = [];
    const steps: readonly LoadingStep[] = [{
      label: "Puppet test",
      run: () => preloadPuppetAssets(assets, { loader, maxRetries: 0, attemptTimeoutMs: 1_000 }),
    }];
    const scene = { scene: { isActive: () => true } } as never;
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const running = runLoadingSteps(scene, (count) => done.push(count), steps);
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toEqual([]);

    // 느린 성공을 마친 뒤에만 완료 칸과 URL·오류 진단이 함께 노출된다.
    releaseSlow?.();
    await running;
    expect(done).toEqual([1]);
    expect(diagnostic).toHaveBeenCalledWith(
      "[loading:Puppet test] Puppet assets failed",
      expect.objectContaining({
        failures: [expect.objectContaining({ assetUrl: "broken.zip", error: expect.any(Error) })],
        fallbackAvailable: true,
      }),
    );
    diagnostic.mockRestore();
  });

  it("로딩 단계 예외를 라벨과 실제 Error로 공용 진단 상태에 기록하고 다음 단계를 진행한다", async () => {
    const failure = new Error("font transport detail");
    const host = globalThis as typeof globalThis & { __PF_DEBUG?: { loadingDiagnostics?: unknown[] } };
    host.__PF_DEBUG = undefined;
    const done: number[] = [];
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scene = { scene: { isActive: () => true } } as never;

    await runLoadingSteps(scene, (count) => done.push(count), [
      { label: "글꼴", run: async () => { throw failure; } },
      { label: "후속", run: async () => undefined },
    ]);

    // 사용자 화면 문자열이 아니라 개발 전역에 원래 Error 객체가 그대로 남아 stack도 잃지 않는다.
    expect((globalThis as typeof globalThis & { __PF_DEBUG?: { loadingDiagnostics?: unknown[] } }).__PF_DEBUG?.loadingDiagnostics).toEqual([{ label: "글꼴", error: failure }]);
    expect(done).toEqual([1, 2]);
    diagnostic.mockRestore();
  });
});
