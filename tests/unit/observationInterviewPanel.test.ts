import { describe, expect, it } from "vitest";
import { OBSERVATION_INTERVIEW_LAYOUT, observationInterviewPanelState } from "../../src/ui/observationInterviewPanel";

describe("observation interview panel static state and layout", () => {
  it("closes and reopens one selection panel with the same toggle", () => {
    // 토글은 새 팝업을 누적하지 않고 현재 한 장의 열림 값만 뒤집는다.
    const opened = observationInterviewPanelState({ open: false, completedToday: false }, "toggle");
    expect(opened.open).toBe(true);
    expect(observationInterviewPanelState(opened, "toggle").open).toBe(false);
    expect(observationInterviewPanelState(observationInterviewPanelState(opened, "close"), "toggle").open).toBe(true);
  });

  it("closes after completion and preserves the daily completion boundary", () => {
    // 저장 성공 뒤 complete 전이만 완료 상태를 만들며, 이후 토글은 다시 열지 않는다.
    const completed = observationInterviewPanelState({ open: true, completedToday: false }, "complete");
    expect(completed).toEqual({ open: false, completedToday: true });
    expect(observationInterviewPanelState(completed, "toggle")).toEqual(completed);
  });

  it("fits every answer in one slanted popup without overlapping its close area", () => {
    const layout = OBSERVATION_INTERVIEW_LAYOUT;
    // 현재 정적 질문은 세 답변이며 마지막 답변까지 팝업 하단 안쪽에 남는다.
    const lastBottom = layout.choice.firstY + layout.choice.step * 2 + layout.choice.height / 2;
    expect(lastBottom).toBeLessThan(layout.popup.height / 2);
    expect(layout.choice.width).toBeLessThan(layout.popup.width);
    expect(layout.trigger.width).toBeGreaterThan(layout.choice.width);
  });
});
