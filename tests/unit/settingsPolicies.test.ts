import { describe, expect, it } from "vitest";
import { colorAssistPolicy, createDefaultSettings, decorativeUpdateBudget, excavationStageDuration, motionPolicy, powerSavingPolicy, presentationPolicy } from "../../src/core/settings";
import { flashPolicy } from "../../src/ui/signatureEffects";
import { COLOR_ASSIST_LAYOUT, COLOR_ASSIST_SURFACES } from "../../src/ui/colorAssist";

/** 네 저장 토글의 on/off가 Phaser 없이도 각 소비 경계의 실제 정책 차이를 고정한다. */
describe("settings presentation policies", () => {
  it.each([
    // 절전, 움직임 감소, 가시성, 최종 배율, 가시성 정지를 모든 조합으로 고정한다.
    [false, false, "visible", 1, false], [true, false, "visible", 0.5, false],
    [false, true, "visible", 0.25, false], [true, true, "visible", 0.25, false],
    [false, false, "hidden", 0, true], [true, true, "hidden", 0, true],
  ] as const)("절전 정책 조합 %#을 분리한다", (powerSaving, reduceMotion, visibility, factor, paused) => {
    const settings = createDefaultSettings();
    settings.presentation.powerSaving = powerSaving; settings.accessibility.reduceMotion = reduceMotion;
    const policy = powerSavingPolicy(settings, visibility);
    expect(policy).toEqual({ decorativeParticleFactor: factor, hologramSweepFactor: factor, idlePuppetUpdateFactor: factor, pausedByVisibility: paused });
  });

  it("로비·정보창·방치 발굴은 같은 장식 업데이트 예산만 줄인다", () => {
    const settings = createDefaultSettings(); settings.presentation.powerSaving = true;
    const policy = powerSavingPolicy(settings);
    // 세 화면의 60Hz 장식 예산만 30Hz로 줄며 정책에는 전투·타이머·입력용 필드가 존재하지 않는다.
    expect(["lobby", "info", "idleExcavation"].map(surface => decorativeUpdateBudget(surface as "lobby" | "info" | "idleExcavation", policy))).toEqual([30, 30, 30]);
    expect(policy).not.toHaveProperty("combatFactor"); expect(policy).not.toHaveProperty("timerFactor"); expect(policy).not.toHaveProperty("inputFactor");
  });
  it("세 품질 프리셋은 게임 규칙이 아닌 명시적 렌더 예산만 단계별로 줄인다", () => {
    const high = presentationPolicy("high");
    const balanced = presentationPolicy("balanced");
    const low = presentationPolicy("low");
    expect(high).toEqual({ particleRatio: 1, ringRatio: 1, fullBodyScale: 1, postProcessing: true, renderQuality: 1 });
    expect(balanced).toEqual({ particleRatio: 0.72, ringRatio: 0.75, fullBodyScale: 0.9, postProcessing: true, renderQuality: 0.9 });
    expect(low).toEqual({ particleRatio: 0.45, ringRatio: 0.5, fullBodyScale: 0.78, postProcessing: false, renderQuality: 0.75 });
    // 모든 작업량은 high → balanced → low 순서로만 줄어 프리셋 전환이 일관된다.
    expect([high, balanced, low].map(({ particleRatio }) => particleRatio)).toEqual([1, 0.72, 0.45]);
  });

  it.each([
    // 화면 흔들림, 전체 감소, 전투 UI 선택, 카메라, 전투 UI, 거리, 반복의 최종값을 조합별로 고정한다.
    [true, false, "default", 1, 1, 1, 1],
    [false, false, "default", 0, 1, 1, 1],
    [true, true, "default", 0.4, 0.4, 0.4, 0],
    [false, true, "default", 0, 0.4, 0.4, 0],
    [true, false, "reduced", 1, 0.4, 1, 1],
    [true, true, "reduced", 0.4, 0.4, 0.4, 0],
    [true, false, "off", 1, 0, 1, 1],
    [true, true, "off", 0.4, 0, 0.4, 0],
  ] as const)("움직임 정책 조합 %#의 최종 배율을 고정한다", (screenShake, reduceMotion, battleUiMotion, camera, battleUi, distance, repeats) => {
    const policy = motionPolicy({ presentation: { screenShake, battleUiMotion }, accessibility: { reduceMotion } });
    expect(policy).toMatchObject({ cameraShakeFactor: camera, battleUiFactor: battleUi, nonEssentialDistanceFactor: distance, nonEssentialRepeatFactor: repeats });
  });

  it("대표 값은 종류별 글리프와 패턴에 명시적으로 고정된다", () => {
    expect(colorAssistPolicy(true, "element", "fire")).toEqual({ glyph: "▲", pattern: "diagonal" });
    expect(colorAssistPolicy(true, "element", "water")).toEqual({ glyph: "●", pattern: "dots" });
    expect(colorAssistPolicy(true, "rarity", "SSR")).toEqual({ glyph: "✦", pattern: "crosshatch" });
    expect(colorAssistPolicy(true, "status", "debuff")).toEqual({ glyph: "−", pattern: "diagonal" });
  });

  it("우선 화면은 모두 정적 장부와 텍스트 밖 고정 앵커를 가진다", () => {
    expect(COLOR_ASSIST_SURFACES.map((surface) => surface.id)).toEqual(["battle-status-chip", "relic-card-and-info", "party-affinity", "reward-frame"]);
    expect(COLOR_ASSIST_LAYOUT).toEqual({ card: { inset: 14, size: 30 }, statusChip: { inset: 5, size: 18 }, affinity: { offsetX: 31, size: 20 }, reward: { inset: 7, size: 22 } });
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
