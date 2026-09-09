import { describe, expect, it, vi } from "vitest";
import { loadOwnedPuppet } from "../../src/ui/statusPuppetLoad";

/** 실제 Phaser/WebGL 없이 destroy 횟수와 fallback 가시성만 관찰하는 Puppet 대역이다. */
function puppet(displayable = true) { return { displayable, destroy: vi.fn() }; }

describe("idle excavation Puppet loader boundary", () => {
  it("표시 가능한 성공 결과만 채택해 fallback을 숨긴다", async () => {
    const root = puppet(); const hideFallback = vi.fn();
    const result = await loadOwnedPuppet({ spawn: async () => root, isCurrent: () => true, isDisplayable: (value) => value.displayable, adopt: hideFallback });
    expect(result.status).toBe("adopted"); expect(hideFallback).toHaveBeenCalledWith(root); expect(root.destroy).not.toHaveBeenCalled();
  });

  it("spawn 실패는 fallback을 유지한다", async () => {
    const adopt = vi.fn(); const error = new Error("mock load failure");
    const result = await loadOwnedPuppet({ spawn: async () => { throw error; }, isCurrent: () => true, isDisplayable: () => true, adopt });
    expect(result).toEqual({ status: "failed", error }); expect(adopt).not.toHaveBeenCalled();
  });

  it("표시 검증 실패는 한 번 파괴하고 fallback을 유지한다", async () => {
    const root = puppet(false); const adopt = vi.fn();
    const result = await loadOwnedPuppet({ spawn: async () => root, isCurrent: () => true, isDisplayable: (value) => value.displayable, adopt });
    expect(result).toEqual({ status: "discarded", reason: "not-displayable" }); expect(root.destroy).toHaveBeenCalledTimes(1); expect(adopt).not.toHaveBeenCalled();
  });

  it.each(["이전 render의 늦은 완료", "팝업 닫힘 직후 완료"])("%s는 중복 destroy 없이 버린다", async () => {
    const root = puppet(); let current = true; let resolve!: (value: typeof root) => void;
    const pending = new Promise<typeof root>((done) => { resolve = done; });
    const loading = loadOwnedPuppet({ spawn: () => pending, isCurrent: () => current, isDisplayable: () => true, adopt: vi.fn() });
    current = false; resolve(root); const result = await loading;
    expect(result).toEqual({ status: "discarded", reason: "stale" }); expect(root.destroy).toHaveBeenCalledTimes(1);
  });
});
