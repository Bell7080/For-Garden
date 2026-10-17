import { describe, expect, it } from "vitest";
import {
  battleFeatureOpen, battleFeatureToTeach, canCompleteTutorialStep, createCompletedTutorialState, createEmptyTutorialState,
  isTutorialComplete, legacyTutorialState, lobbyTutorialStep, nextTutorialStep, normalizeTutorialState, TUTORIAL_STEPS,
} from "../../src/core/tutorial";

describe("첫 플레이 튜토리얼 순서표", () => {
  it("은 순서가 맞는 앞쪽 접두사만 남긴다", () => {
    expect(normalizeTutorialState({ completedStepIds: ["ultimate", "auto"] }).completedStepIds).toEqual(["ultimate"]);
    expect(normalizeTutorialState({ completedStepIds: ["speed"] }).completedStepIds).toEqual([]);
    expect(normalizeTutorialState({ completedStepIds: ["ultimate", "ultimate", "???"] }).completedStepIds).toEqual(["ultimate"]);
    expect(normalizeTutorialState(undefined)).toEqual(createEmptyTutorialState());
  });

  it("은 지금 차례인 칸과 이미 마친 칸만 마칠 수 있다", () => {
    const state = { completedStepIds: ["ultimate" as const] };
    expect(nextTutorialStep(state)).toBe("speed");
    expect(canCompleteTutorialStep(state, "speed")).toBe(true);
    expect(canCompleteTutorialStep(state, "ultimate")).toBe(true);
    expect(canCompleteTutorialStep(state, "auto")).toBe(false);
  });

  it("은 전투 조작을 자기 칸을 마친 뒤에만 열고 스토리 밖 전투는 늘 연다", () => {
    const empty = createEmptyTutorialState();
    expect(battleFeatureOpen(empty, "speed", true)).toBe(false);
    expect(battleFeatureOpen(empty, "speed", false)).toBe(true);
    const afterSpeed = { completedStepIds: ["ultimate", "speed"] as const };
    expect(battleFeatureOpen({ completedStepIds: [...afterSpeed.completedStepIds] }, "speed", true)).toBe(true);
    expect(battleFeatureOpen({ completedStepIds: [...afterSpeed.completedStepIds] }, "auto", true)).toBe(false);
  });

  it("은 차례가 된 전투 조작 하나만 알려 준다", () => {
    expect(battleFeatureToTeach(createEmptyTutorialState())).toBeUndefined();
    expect(battleFeatureToTeach({ completedStepIds: ["ultimate"] })).toBe("speed");
    expect(battleFeatureToTeach({ completedStepIds: ["ultimate", "speed", "auto", "presentation", "contribution"] })).toBeUndefined();
  });

  it("은 전투 칸이 끝난 뒤에만 로비가 안내한다", () => {
    expect(lobbyTutorialStep({ completedStepIds: ["ultimate"] })).toBeUndefined();
    expect(lobbyTutorialStep({ completedStepIds: ["ultimate", "speed", "auto", "presentation", "contribution"] })).toBe("feed");
    expect(lobbyTutorialStep(createCompletedTutorialState())).toBeUndefined();
    expect(isTutorialComplete(createCompletedTutorialState())).toBe(true);
    expect(TUTORIAL_STEPS.at(-1)).toBe("pull");
  });

  it("은 튜토리얼 이전 저장의 진행 정도에 맞춰 시작한다", () => {
    expect(legacyTutorialState([])).toEqual(createEmptyTutorialState());
    expect(legacyTutorialState(["1-1"]).completedStepIds).toEqual(["ultimate"]);
    expect(isTutorialComplete(legacyTutorialState(["1-1", "1-2"]))).toBe(true);
  });
});
