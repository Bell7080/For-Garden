import { describe, expect, it } from "vitest";
import { MISSIONS } from "../../src/core/missions";
import { ACHIEVEMENT_SERIES } from "../../src/data/achievements";
import { metricShortcut, missionShortcut } from "../../src/data/objectiveShortcuts";
import { normalizeLobbyEntry } from "../../src/scenes/lobbyEntry";

describe("임무·업적 바로가기", () => {
  it("관찰 질문 답변은 관찰 일지의 질문 쪽으로 간다", () => {
    expect(metricShortcut("observationAnswers")).toEqual({ kind: "observation" });
  });

  it("전투·연구·급여처럼 하는 곳이 정해진 일일 임무는 모두 갈 곳이 있다", () => {
    for (const id of ["daily-battle", "daily-excavate", "daily-salary"]) {
      expect(missionShortcut(id), id).toBeDefined();
    }
  });

  it("화면이 아닌 일(일일 임무 완료 · 로비 인사)과 모르는 임무에는 버튼을 세우지 않는다", () => {
    const blank = MISSIONS.filter(({ event }) => event === "daily_mission_claimed" || event === "lobby_interaction");
    for (const mission of blank) expect(missionShortcut(mission.id), mission.id).toBeUndefined();
    expect(missionShortcut("no-such-mission")).toBeUndefined();
  });

  it("숨은 편성 기록은 길을 알려 주지 않는다", () => {
    for (const metric of ["partySameElement", "partySquads", "partySsr"] as const) expect(metricShortcut(metric)).toBeUndefined();
  });

  it("업적 대부분은 갈 곳이 있다 — 빈 칸은 쌓이기만 하는 값·숨은 기록뿐이다", () => {
    const blank = ACHIEVEMENT_SERIES.filter(({ metric }) => metricShortcut(metric) === undefined).map(({ metric }) => metric);
    expect(blank.every((metric) => ["goldPeak", "lobbyGreetings", "modifiersEarned", "nicknameSet", "giftsDelivered", "partySameElement", "partySquads", "partySsr"].includes(metric))).toBe(true);
  });

  it("로비 판 도감·가방도 진입 데이터로 열린다", () => {
    expect(normalizeLobbyEntry({ menu: "codex" })).toBe("codex");
    expect(normalizeLobbyEntry({ menu: "inventory" })).toBe("inventory");
  });
});
