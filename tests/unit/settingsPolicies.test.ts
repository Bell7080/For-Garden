import { describe, expect, it } from "vitest";
import { colorAssistPolicy, excavationStageDuration, presentationPolicy } from "../../src/core/settings";
import { flashPolicy } from "../../src/ui/signatureEffects";

/** 네 저장 토글의 on/off가 Phaser 없이도 각 소비 경계의 실제 정책 차이를 고정한다. */
describe("settings presentation policies", () => {
  it("저사양 모드는 파티클·파문·전신·후처리·렌더 품질 예산을 함께 낮춘다", () => {
    const full = presentationPolicy(false);
    const low = presentationPolicy(true);
    expect(full).toEqual({ particleRatio: 1, ringRatio: 1, fullBodyScale: 1, postProcessing: true, renderQuality: 1 });
    expect(low.particleRatio).toBeLessThan(full.particleRatio);
    expect(low.ringRatio).toBeLessThan(full.ringRatio);
    expect(low.fullBodyScale).toBeLessThan(full.fullBodyScale);
    expect(low).toMatchObject({ postProcessing: false, renderQuality: 0.75 });
  });

  it("연구 연출 단축은 모든 단계 시간을 줄이되 읽기 하한을 지킨다", () => {
    for (const stage of ["scan", "crack", "rarity", "firstMeeting"] as const) {
      expect(excavationStageDuration(stage, true)).toBeLessThan(excavationStageDuration(stage, false));
      expect(excavationStageDuration(stage, true)).toBeGreaterThanOrEqual(240);
    }
  });

  it("섬광 감소는 공용 밝기와 반복 횟수를 제한하고 투명 진입을 없앤다", () => {
    expect(flashPolicy(false)).toEqual({ alphaRatio: 1, maxRepeats: 2, fadeFromTransparent: true });
    expect(flashPolicy(true)).toEqual({ alphaRatio: 0.32, maxRepeats: 0, fadeFromTransparent: false });
  });

  it("색각 보조는 기존 색을 바꾸지 않고 의미별 글리프와 패턴만 더한다", () => {
    expect(colorAssistPolicy(false, "rarity", "SSR")).toEqual({ glyph: "", pattern: "none" });
    const assisted = colorAssistPolicy(true, "rarity", "SSR");
    expect(assisted.glyph).not.toBe("");
    expect(assisted.pattern).not.toBe("none");
    expect(colorAssistPolicy(true, "rarity", "SSR")).toEqual(assisted);
  });
});
