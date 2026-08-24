import { describe, expect, it } from "vitest";
import { applyMissionEvent, MISSIONS, missionPeriodKeys, normalizeMissions, type MissionState } from "../../src/core/missions";

/** 기간 경계 테스트가 공유하는 직렬화 가능한 진행 스냅샷이다. */
const progressed = (): MissionState => ({
  dailyKey: "2026-08-23",
  weeklyKey: "2026-08-17",
  progress: { "daily-battle": 1, "weekly-battle": 3 },
  claimedIds: ["daily-battle"],
});

describe("mission rules", () => {
  it("UTC 00:00에 일일 진행과 수령만 초기화한다", () => {
    const next = normalizeMissions(progressed(), new Date("2026-08-24T00:00:00Z"));
    expect(next).toMatchObject({ dailyKey: "2026-08-24", weeklyKey: "2026-08-24", claimedIds: [] });
    // 이 날짜는 월요일이므로 주간 진행도 함께 바뀐다.
    expect(next.progress).toEqual({});
  });

  it("같은 주의 UTC 일자 변경은 주간 진행을 보존한다", () => {
    const state = progressed(); state.dailyKey = "2026-08-19";
    const next = normalizeMissions(state, new Date("2026-08-20T00:00:00Z"));
    expect(next.progress).toEqual({ "weekly-battle": 3 });
    expect(missionPeriodKeys(new Date("2026-08-20T23:59:59Z")).weeklyKey).toBe("2026-08-17");
  });

  it("성공한 도메인 이벤트만 목표 상한까지 관련 일일·주간 임무에 반영한다", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    let state: MissionState = { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] };
    state = applyMissionEvent(state, { type: "battle_completed", victory: false }, now);
    expect(state.progress).toEqual({});
    for (let count = 0; count < 8; count += 1) state = applyMissionEvent(state, { type: "battle_completed", victory: true }, now);
    expect(state.progress).toMatchObject({ "daily-battle": 1, "weekly-battle": 5 });
  });

  it("연구소 캐릭터 연구 이벤트만 기존 발굴 저장 ID의 임무를 올린다", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const state: MissionState = { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] };
    const next = applyMissionEvent(state, { type: "relic_research_completed", count: 3 }, now);
    // ID는 마이그레이션 없이 유지하고 사용자 제목만 방치 발굴과 구별한다.
    expect(MISSIONS.find((mission) => mission.id === "daily-excavate")?.title).toBe("연구소 캐릭터 연구 1회");
    expect(next.progress).toMatchObject({ "daily-excavate": 1, "weekly-excavate": 3 });
  });
});
