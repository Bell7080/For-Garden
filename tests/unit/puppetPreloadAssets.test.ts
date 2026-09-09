import { describe, expect, it, vi } from "vitest";
import {
  ALLY_SD_ASSETS,
  PORTRAIT_ASSETS,
  PUPPET_PRELOAD_GROUPS,
  preloadPuppetAssets,
  retryFailedPuppetAssetsForBattle,
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
      "[loading:Puppet test] partial",
      [expect.objectContaining({ assetUrl: "broken.zip", error: expect.any(Error), errorKind: "Error" })],
    );
    diagnostic.mockRestore();
  });

  it("성공 URL을 보존하고 다음 전투에서는 실패 목록과 현재 편성의 교집합만 재시도한다", async () => {
    // 세 URL 중 하나만 실패시킨 뒤 관련 없는 성공/실패가 전투 준비 대상으로 되살아나지 않는지 검증한다.
    const template = Object.values(PORTRAIT_ASSETS)[0];
    const assets = ["cached.zip", "needed.zip", "unused-broken.zip"].map((url) => ({ ...template, url }));
    const initialLoader = vi.fn((asset: PuppetAsset) => asset.url === "cached.zip" ? Promise.resolve() : Promise.reject(new Error("offline")));
    const initial = await preloadPuppetAssets(assets, { loader: initialLoader, maxRetries: 0 });
    expect(initial).toMatchObject({ status: "partial", successfulUrls: ["cached.zip"] });
    expect(initial.failures.map(({ assetUrl }) => assetUrl)).toEqual(["needed.zip", "unused-broken.zip"]);

    const retryLoader = vi.fn(() => Promise.resolve());
    const retried = await retryFailedPuppetAssetsForBattle(
      [{ ...template, url: "cached.zip" }, { ...template, url: "needed.zip" }],
      { loader: retryLoader, maxRetries: 0 },
    );
    expect(retryLoader).toHaveBeenCalledTimes(1);
    expect(retried).toMatchObject({ status: "success", successfulUrls: ["needed.zip"], failures: [] });
  });
});
