import { describe, expect, it } from "vitest";
import {
  battleFeatureOpen, battleFeatureToTeach, CONTENT_INTRO_IDS, shouldShowContentIntro, canCompleteTutorialStep, createCompletedTutorialState, createEmptyTutorialState,
  advanceTutorialOnStageClear, stageClearAdvancesTutorial, isTutorialComplete, legacyTutorialState, lobbyTutorialStep, nextTutorialStep, normalizeTutorialState, TUTORIAL_STEPS,
} from "../../src/core/tutorial";

describe("첫 플레이 튜토리얼 순서표", () => {
  it("은 순서가 맞는 앞쪽 접두사만 남긴다", () => {
    expect(normalizeTutorialState({ completedStepIds: ["ultimate", "presentation"] }).completedStepIds).toEqual(["ultimate"]);
    expect(normalizeTutorialState({ completedStepIds: ["speed"] }).completedStepIds).toEqual([]);
    expect(normalizeTutorialState({ completedStepIds: ["ultimate", "ultimate", "???"] }).completedStepIds).toEqual(["ultimate"]);
    expect(normalizeTutorialState(undefined)).toEqual(createEmptyTutorialState());
  });

  it("은 지금 차례인 칸과 이미 마친 칸만 마칠 수 있다", () => {
    const state = { completedStepIds: ["ultimate" as const] };
    expect(nextTutorialStep(state)).toBe("auto");
    expect(canCompleteTutorialStep(state, "auto")).toBe(true);
    expect(canCompleteTutorialStep(state, "ultimate")).toBe(true);
    expect(canCompleteTutorialStep(state, "presentation")).toBe(false);
  });

  it("은 전투 조작을 자기 칸을 마친 뒤에만 열고 스토리 밖 전투는 늘 연다", () => {
    const empty = createEmptyTutorialState();
    expect(battleFeatureOpen(empty, "auto", true)).toBe(false);
    expect(battleFeatureOpen(empty, "auto", false)).toBe(true);
    const afterAuto = { completedStepIds: ["ultimate", "auto"] as const };
    expect(battleFeatureOpen({ completedStepIds: [...afterAuto.completedStepIds] }, "auto", true)).toBe(true);
    expect(battleFeatureOpen({ completedStepIds: [...afterAuto.completedStepIds] }, "presentation", true)).toBe(false);
    expect(battleFeatureOpen({ completedStepIds: [...afterAuto.completedStepIds] }, "speed", true)).toBe(false);
  });

  it("은 차례가 된 전투 조작 하나만 알려 준다", () => {
    expect(battleFeatureToTeach(createEmptyTutorialState())).toBeUndefined();
    expect(battleFeatureToTeach({ completedStepIds: ["ultimate"] })).toBe("auto");
    expect(battleFeatureToTeach({ completedStepIds: ["ultimate", "auto", "presentation", "speed", "contribution"] })).toBeUndefined();
  });

  it("은 전투 칸이 끝난 뒤에만 로비가 안내한다", () => {
    expect(lobbyTutorialStep({ completedStepIds: ["ultimate"] })).toBeUndefined();
    expect(lobbyTutorialStep({ completedStepIds: ["ultimate", "auto", "presentation", "speed", "contribution"] })).toBe("feed");
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

describe("스테이지 클리어가 여는 전투 조작", () => {
  it("은 오프닝 1-1·SUB·알 수 없는 관문의 클리어로는 열지 않는다", () => {
    expect(stageClearAdvancesTutorial({ id: "1-2" })).toBe(true);
    expect(stageClearAdvancesTutorial({ id: "1-1" })).toBe(false);
    expect(stageClearAdvancesTutorial({ id: "1-8-sub", sub: true })).toBe(false);
    expect(stageClearAdvancesTutorial(undefined)).toBe(false);
  });

  it("은 한 번에 한 칸만 앞으로 가고 전투 칸이 끝나면 멈춘다", () => {
    const one = advanceTutorialOnStageClear({ completedStepIds: ["ultimate"] });
    expect(one.completedStepIds).toEqual(["ultimate", "auto"]);
    const last = { completedStepIds: ["ultimate", "auto", "presentation", "speed", "contribution"] as const };
    expect(advanceTutorialOnStageClear({ completedStepIds: [...last.completedStepIds] }).completedStepIds).toEqual(last.completedStepIds);
    expect(advanceTutorialOnStageClear(createEmptyTutorialState())).toEqual(createEmptyTutorialState());
  });
});

describe("콘텐츠 첫 방문 안내", () => {
  it("은 튜토리얼을 마친 뒤 아직 안 본 것만 띄운다", () => {
    expect(shouldShowContentIntro(createEmptyTutorialState(), "raid")).toBe(false);
    const done = { completedStepIds: [...TUTORIAL_STEPS] };
    expect(shouldShowContentIntro(done, "raid")).toBe(true);
    expect(shouldShowContentIntro({ ...done, seenIntroIds: ["raid"] }, "raid")).toBe(false);
  });

  it("은 모르는 ID를 버리고 비면 필드를 두지 않는다", () => {
    expect(normalizeTutorialState({ completedStepIds: [], seenIntroIds: ["nope"] })).toEqual({ completedStepIds: [] });
    expect(normalizeTutorialState({ completedStepIds: [], seenIntroIds: ["duel", "raid", "x"] }).seenIntroIds).toEqual(["raid", "duel"].sort((a, b) => CONTENT_INTRO_IDS.indexOf(a as never) - CONTENT_INTRO_IDS.indexOf(b as never)));
  });

  it("은 모두 마친 상태에서 안내도 모두 본 것으로 시작한다", () => {
    expect(createCompletedTutorialState().seenIntroIds).toEqual([...CONTENT_INTRO_IDS]);
  });
});
