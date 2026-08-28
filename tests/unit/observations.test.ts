import { describe, expect, it } from "vitest";
import { DialogueFlow } from "../../src/core/dialogue";
import {
  COMMON_OBSERVATION_QUESTIONS,
  RELIC_OBSERVATION_QUESTIONS,
  createObservationStory,
  observationQuestionForDate,
  observationQuestionForRelicAndDate,
} from "../../src/data/observations";
import { ObservationManager } from "../../src/managers/ObservationManager";
import { createDefaultSession } from "../../src/state/session";

/** 렐릭별 지정 질문이 순환 중 등장하는 날짜를 찾아 테스트가 배치 구현 세부값에 묶이지 않게 한다. */
function dateForQuestion(relicId: string, questionId: string): string {
  for (let day = 1; day <= 31; day += 1) {
    const date = `2026-08-${String(day).padStart(2, "0")}`;
    if (observationQuestionForRelicAndDate(relicId, date).id === questionId) return date;
  }
  throw new Error(`순환에서 질문을 찾지 못했습니다: ${questionId}`);
}

describe("관찰 인터뷰", () => {
  it("같은 토리카와 UTC 날짜에는 항상 같은 전용 질문을 조합한다", () => {
    const questionId = RELIC_OBSERVATION_QUESTIONS.anky[0].id;
    const date = dateForQuestion("anky", questionId);
    const first = observationQuestionForRelicAndDate("anky", date);
    expect(observationQuestionForRelicAndDate("anky", date)).toBe(first);

    const flow = new DialogueFlow(createObservationStory("anky", "토리카", date));
    expect(flow.current.id).toBe("intro");
    flow.advance();
    flow.unlockInput();
    expect(flow.current.body).toBe(first.prompt);
  });

  it("토리카 전용 질문은 다른 렐릭의 질문 순환에 새어 나가지 않는다", () => {
    const privateIds = new Set(RELIC_OBSERVATION_QUESTIONS.anky.map(({ id }) => id));
    for (let day = 1; day <= 31; day += 1) {
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      expect(privateIds.has(observationQuestionForRelicAndDate("rex", date).id)).toBe(false);
    }
  });

  it("각 신규 선택의 서로 다른 태그와 습성 문장을 기록한다", () => {
    for (const question of RELIC_OBSERVATION_QUESTIONS.anky) {
      const date = dateForQuestion("anky", question.id);
      for (const choice of question.choices) {
        // 선택마다 독립 저장을 만들어 하루 한 명 제한과 무관하게 스냅샷 내용을 검증한다.
        const state = createDefaultSession();
        const manager = new ObservationManager(state, { save: () => undefined });
        const result = manager.complete("anky", date, choice.id);
        expect(result.record).toMatchObject({ questionId: question.id, choiceId: choice.id, personalityTag: choice.personalityTag });
        expect(result.record.discoveredHabit).not.toBe("새로운 반응 양식을 기록했다.");
        expect(result.record.discoveredHabit.length).toBeGreaterThan(10);
      }
      expect(new Set(question.choices.map(({ personalityTag }) => personalityTag)).size).toBe(question.choices.length);
      expect(new Set(question.choices.map(({ habitKey }) => habitKey)).size).toBe(question.choices.length);
    }
  });

  it("렉시아의 모든 전용 질문만 렉시아 날짜 순환에 등장한다", () => {
    const rexIds = new Set(RELIC_OBSERVATION_QUESTIONS.rex.map(({ id }) => id));
    const otherPrivateIds = new Set(RELIC_OBSERVATION_QUESTIONS.anky.map(({ id }) => id));
    for (const question of RELIC_OBSERVATION_QUESTIONS.rex) {
      expect(observationQuestionForRelicAndDate("rex", dateForQuestion("rex", question.id)).id).toBe(question.id);
    }
    for (let day = 1; day <= 31; day += 1) {
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      expect(rexIds.has(observationQuestionForRelicAndDate("anky", date).id)).toBe(false);
      expect(rexIds.has(observationQuestionForRelicAndDate("spino", date).id)).toBe(false);
      expect(otherPrivateIds.has(observationQuestionForRelicAndDate("rex", date).id)).toBe(false);
    }
  });

  it("렉시아의 각 선택을 고유한 성격 태그와 관찰 습성으로 저장한다", () => {
    for (const question of RELIC_OBSERVATION_QUESTIONS.rex) {
      const date = dateForQuestion("rex", question.id);
      const savedTags = new Set<string>();
      const savedHabits = new Set<string>();
      for (const choice of question.choices) {
        // 선택별 새 세션은 일일 완료 제한을 피하면서 실제 저장 경계까지 검증한다.
        const manager = new ObservationManager(createDefaultSession(), { save: () => undefined });
        const { record } = manager.complete("rex", date, choice.id);
        expect(record).toMatchObject({ questionId: question.id, choiceId: choice.id, personalityTag: choice.personalityTag });
        expect(record.discoveredHabit).not.toBe("새로운 반응 양식을 기록했다.");
        savedTags.add(record.personalityTag);
        savedHabits.add(record.discoveredHabit);
      }
      expect(savedTags.size).toBe(question.choices.length);
      expect(savedHabits.size).toBe(question.choices.length);
    }
  });

  it("하루 한 명의 첫 완료만 기록과 작은 유대 보상을 지급하고 재관람은 무보상이다", () => {
    const state = createDefaultSession();
    const manager = new ObservationManager(state, { save: () => undefined });
    const date = "2026-08-22";
    const choice = observationQuestionForRelicAndDate("anky", date).choices[0];
    const before = state.relicProgress.anky.bondXp;
    const first = manager.complete("anky", date, choice.id);
    expect(first.bondXpEarned).toBe(5);
    expect(first.record.personalityTag).toBe(choice.personalityTag);
    expect(state.relicProgress.anky.bondXp).toBe(before + 5);
    expect(manager.canStart("rex", date)).toBe(false);
    expect(manager.complete("anky", date, choice.id)).toMatchObject({ bondXpEarned: 0, firstCompletion: false });
    const rexChoice = observationQuestionForRelicAndDate("rex", date).choices[0];
    expect(() => manager.complete("rex", date, rexChoice.id)).toThrow("이미 완료");
  });

  it("과거 공용 질문 ID와 날짜 전용 API의 결과를 그대로 유지한다", () => {
    expect(COMMON_OBSERVATION_QUESTIONS.map(({ id }) => id)).toEqual(["unknown-sound", "shared-food"]);
    expect(observationQuestionForDate("2026-08-22").id).toBe("unknown-sound");
    // 질문과 모든 선택의 영속 ID가 렐릭별 풀을 합쳐도 충돌하지 않아야 한다.
    const privateQuestions = Object.values(RELIC_OBSERVATION_QUESTIONS).flat();
    const allIds = [...COMMON_OBSERVATION_QUESTIONS, ...privateQuestions].map(({ id }) => id);
    expect(new Set(allIds).size).toBe(allIds.length);
    const allChoiceIds = [...COMMON_OBSERVATION_QUESTIONS, ...privateQuestions].flatMap(({ choices }) => choices.map(({ id }) => id));
    expect(new Set(allChoiceIds).size).toBe(allChoiceIds.length);
  });
});
