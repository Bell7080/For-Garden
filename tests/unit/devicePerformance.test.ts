import { describe, expect, it } from "vitest";
import { DEFAULT_IDLE_KEEP, deviceFrameRateLimit, deviceIdleKeep, effectiveFrameRateLimit, defaultAntialias, savedAntialias, savedGraphicsQuality } from "../../src/core/devicePerformance";
import { PUPPET_IDLE_KEEP } from "../../src/core/puppetResidency";
import { BACKGROUND_IDLE_KEEP } from "../../src/ui/backgroundResidency";
import { readFileSync } from "node:fs";

describe("기기 성능 규칙 — 발열 줄이기", () => {
  it("낮음 품질 기기만 30fps로 시작하고 나머지는 60이다", () => {
    expect(deviceFrameRateLimit("low")).toBe(30);
    expect(deviceFrameRateLimit("balanced")).toBe(30);
    expect(deviceFrameRateLimit("high")).toBe(30);
  });

  it("절전은 적용만 30으로 낮추고 저장된 선택은 건드리지 않는다", () => {
    expect(effectiveFrameRateLimit({ frameRateLimit: 120, powerSaving: true })).toBe(30);
    expect(effectiveFrameRateLimit({ frameRateLimit: 60, powerSaving: true })).toBe(30);
    expect(effectiveFrameRateLimit({ frameRateLimit: 30, powerSaving: true })).toBe(30);
    expect(effectiveFrameRateLimit({ frameRateLimit: 120, powerSaving: false })).toBe(120);
  });

  it("안티앨리어싱 기본은 낮음 품질만 끄고, 저장의 선택이 언제나 앞선다", () => {
    expect(defaultAntialias("low")).toBe(false);
    expect(defaultAntialias("balanced")).toBe(true);
    expect(defaultAntialias("high")).toBe(true);
    const save = (presentation: Record<string, unknown>) => JSON.stringify({ settings: { presentation } });
    expect(savedAntialias(null, "high")).toBe(true);
    expect(savedAntialias(null, "low")).toBe(false);
    expect(savedAntialias("{", "high")).toBe(true);
    expect(savedAntialias(save({ graphicsQuality: "low" }), "high")).toBe(false);
    expect(savedAntialias(save({ graphicsQuality: "high" }), "low")).toBe(true);
    expect(savedAntialias(save({ graphicsQuality: "low", antialias: true }), "low")).toBe(true);
    expect(savedAntialias(save({ graphicsQuality: "high", antialias: false }), "high")).toBe(false);
  });

  it("유휴 보관 수는 메모리가 적을수록 줄고, 모르면 기본값이다", () => {
    expect(DEFAULT_IDLE_KEEP).toEqual({ background: BACKGROUND_IDLE_KEEP, puppet: PUPPET_IDLE_KEEP });
    expect(deviceIdleKeep({})).toEqual(DEFAULT_IDLE_KEEP);
    expect(deviceIdleKeep({ deviceMemory: 8 })).toEqual(DEFAULT_IDLE_KEEP);
    expect(deviceIdleKeep({ deviceMemory: 4 })).toEqual({ background: 1, puppet: 5 });
    expect(deviceIdleKeep({ deviceMemory: 2 })).toEqual({ background: 1, puppet: 3 });
    expect(deviceIdleKeep({ deviceMemory: 0.5 }).puppet).toBeGreaterThan(0);
  });

  it("시작 전 품질은 저장에서 읽고, 없거나 깨졌으면 기기 단서를 쓴다", () => {
    expect(savedGraphicsQuality(JSON.stringify({ settings: { presentation: { graphicsQuality: "low" } } }), "high")).toBe("low");
    expect(savedGraphicsQuality(null, "balanced")).toBe("balanced");
    expect(savedGraphicsQuality("{깨짐", "high")).toBe("high");
    expect(savedGraphicsQuality(JSON.stringify({ settings: { presentation: { graphicsQuality: "ultra" } } }), "high")).toBe("high");
  });

  it("거주 규칙은 기기 보관 수를 넘겨 부른다", () => {
    expect(readFileSync("src/ui/backgrounds.ts", "utf8")).toContain("idleKeep: currentIdleKeep().background");
    expect(readFileSync("src/puppets/assets.ts", "utf8")).toContain("currentIdleKeep().puppet");
    expect(readFileSync("src/main.ts", "utf8")).toContain("antialias: startupAntialias()");
  });
});
