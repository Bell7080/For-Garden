import { describe, expect, it } from "vitest";
import { DialogueFlow } from "../../src/core/dialogue";
import { createObservationStory, observationQuestionForDate } from "../../src/data/observations";
import { ObservationManager } from "../../src/managers/ObservationManager";
import { createDefaultSession } from "../../src/state/session";

describe("관찰 인터뷰", () => {
  it("공용 질문과 렐릭 반응을 DialogueStory로 조합한다", () => {
    const date = "2026-08-22";
    const story = createObservationStory("anky", "토리카", date);
    const flow = new DialogueFlow(story);
    expect(flow.current.id).toBe("intro");
    flow.advance();
    flow.unlockInput();
    expect(flow.current.body).toBe(observationQuestionForDate(date).prompt);
  });

  it("하루 한 명의 첫 완료만 기록과 작은 유대 보상을 지급하고 재관람은 무보상이다", () => {
    const state = createDefaultSession();
    const manager = new ObservationManager(state, { save: () => undefined });
    const date = "2026-08-22";
    const choice = observationQuestionForDate(date).choices[0];
    const before = state.relicProgress.anky.bondXp;
    const first = manager.complete("anky", date, choice.id);
    expect(first.bondXpEarned).toBe(5);
    expect(first.record.personalityTag).toBe(choice.personalityTag);
    expect(state.relicProgress.anky.bondXp).toBe(before + 5);
    expect(manager.canStart("rex", date)).toBe(false);
    expect(manager.complete("anky", date, choice.id)).toMatchObject({ bondXpEarned: 0, firstCompletion: false });
    expect(() => manager.complete("rex", date, choice.id)).toThrow("이미 완료");
  });
});
