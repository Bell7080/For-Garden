import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("빌드별 저장 공간 선택", () => {
  it.each([
    ["production", false, "production"], ["qa", false, "qa"], ["test", false, "test"],
    ["development", true, "qa"], ["production", true, "qa"], ["test", true, "test"],
  ] as const)("MODE=%s DEV=%s는 %s 기록만 선택한다", async (mode, dev, expected) => {
    vi.stubEnv("MODE", mode); vi.stubEnv("DEV", dev);
    const { LOCAL_SAVE_FLAVOR, LOCAL_SAVE_STORAGE_KEYS } = await import("../../src/core/saveStorage");
    expect(LOCAL_SAVE_FLAVOR).toBe(expected);
    expect(new Set(Object.values(LOCAL_SAVE_STORAGE_KEYS)).size).toBe(3);
  });
});
