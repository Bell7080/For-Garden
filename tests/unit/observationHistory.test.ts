import { describe, expect, it } from "vitest";
import { clampObservationPage, sortedObservationHistory } from "../../src/ui/observationHistory";
import type { ObservationRecord } from "../../src/state/session";

function record(date: string): ObservationRecord {
  return { date, relicId: "dodo", storyId: `s-${date}`, questionId: "q", question: "?", choiceId: "c", answer: "a", personalityTag: "tag", discoveredHabit: "habit" };
}

describe("관찰 기록 레이어 — 최신 순 정렬", () => {
  it("저장 순서(오래된 것부터)를 최신 순으로 뒤집는다", () => {
    const records = [record("2026-01-01"), record("2026-01-02"), record("2026-01-03")];
    expect(sortedObservationHistory(records).map((entry) => entry.date)).toEqual(["2026-01-03", "2026-01-02", "2026-01-01"]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const records = [record("2026-01-01"), record("2026-01-02")];
    sortedObservationHistory(records);
    expect(records.map((entry) => entry.date)).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("빈 기록은 빈 목록을 준다", () => {
    expect(sortedObservationHistory([])).toEqual([]);
  });
});

describe("관찰 기록 레이어 — 페이지 붙잡기", () => {
  it("범위 안이면 그대로 둔다", () => {
    expect(clampObservationPage(2, 5)).toBe(2);
  });

  it("범위를 벗어나면 가장 가까운 끝으로 붙잡는다", () => {
    expect(clampObservationPage(-1, 5)).toBe(0);
    expect(clampObservationPage(9, 5)).toBe(4);
  });

  it("기록이 없으면 항상 0이다", () => {
    expect(clampObservationPage(3, 0)).toBe(0);
    expect(clampObservationPage(-2, 0)).toBe(0);
  });
});
