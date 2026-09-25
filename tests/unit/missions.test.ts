import { describe, expect, it } from "vitest";
import { addResearchPoints, maxResearchPoints, applyMissionEvent, researchPointsForClaim, claimResearchStages, MISSIONS, missionPeriodKeys, normalizeMissions, type MissionState } from "../../src/core/missions";

/** 기간 경계 테스트가 공유하는 직렬화 가능한 진행 스냅샷이다. */
const progressed = (): MissionState => ({
  dailyKey: "2026-08-23",
  weeklyKey: "2026-08-17",
  progress: { "daily-battle": 1, "weekly-battle": 3 },
  claimedIds: ["daily-battle"],
  researchPoints: { daily: 20, weekly: 60 },
  claimedResearchStageIds: ["daily:research-20"],
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
    let state: MissionState = { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] };
    state = applyMissionEvent(state, { type: "battle_completed", victory: false }, now);
    expect(state.progress).toEqual({});
    for (let count = 0; count < 8; count += 1) state = applyMissionEvent(state, { type: "battle_completed", victory: true }, now);
    expect(state.progress).toMatchObject({ "daily-battle": 1, "weekly-battle": 8 });
  });

  it("연구소 캐릭터 연구 이벤트만 기존 발굴 저장 ID의 임무를 올린다", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const state: MissionState = { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] };
    const next = applyMissionEvent(state, { type: "relic_research_completed", count: 3 }, now);
    // ID는 마이그레이션 없이 유지하고 사용자 제목만 방치 발굴과 구별한다.
    expect(MISSIONS.find((mission) => mission.id === "daily-excavate")?.title).toBe("연구소 캐릭터 연구 1회");
    expect(next.progress).toMatchObject({ "daily-excavate": 1, "weekly-excavate": 3 });
  });

  it("완료만으로는 연구도가 오르지 않고, 수령이 한 번만 올린다", () => {
    // 완료하는 순간 게이지가 저 혼자 차오르면 보상을 받는 손에는 아무 일도 일어나지 않아
    // 두 값이 따로 논다. 연구도는 **수령**이 올리고, 같은 임무는 한 번만 수령할 수 있다.
    const now = new Date("2026-08-20T12:00:00Z");
    let state: MissionState = { dailyKey: "2026-08-20", weeklyKey: "2026-08-17", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] };
    state = applyMissionEvent(state, { type: "battle_completed", victory: true }, now);
    expect(state.researchPoints).toEqual({ daily: 0, weekly: 0 });
    expect(researchPointsForClaim(["daily-battle"])).toEqual({ daily: 20, weekly: 0 });
    // 같은 ID를 여러 번 보내도 한 번만 센다 — 일괄 수령이 같은 임무를 중복으로 담아도 안전하다.
    expect(researchPointsForClaim(["daily-battle", "daily-battle"])).toEqual({ daily: 20, weekly: 0 });
    expect(addResearchPoints(state, researchPointsForClaim(["daily-battle"])).researchPoints).toEqual({ daily: 20, weekly: 0 });
  });

  it("여러 임무가 동시에 완료되면 통과한 여러 연구도 단계를 한 번씩 수령한다", () => {
    const state: MissionState = { dailyKey: "2026-08-20", weeklyKey: "2026-08-17", progress: {}, claimedIds: [], researchPoints: { daily: 80, weekly: 0 }, claimedResearchStageIds: [] };
    const first = claimResearchStages(state, "daily");
    expect(first.claimedStageIds).toEqual(["research-20", "research-40", "research-60", "research-80"]);
    // 단계 보상은 한 재화로 채우지 않는다 — 골드·치즈케이크·다이아가 들어오고 같은 다이아는 한 줄로 모인다.
    expect(first.rewards).toEqual([{ currency: "gold", amount: 10_000 }, { currency: "cheesecake", amount: 30 }, { currency: "gems", amount: 50 }]);
    expect(claimResearchStages(first.state, "daily").rewards).toEqual([]);
  });

  it("주간 연구도는 주간 표를 쓰고, 일일 임무 수령 수를 주간 임무가 센다", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const base: MissionState = { dailyKey: "2026-08-20", weeklyKey: "2026-08-17", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 300 }, claimedResearchStageIds: [] };
    expect(claimResearchStages(base, "weekly").claimedStageIds).toEqual(["research-100", "research-200", "research-300"]);
    const next = applyMissionEvent(base, { type: "daily_mission_claimed", count: 3 }, now);
    expect(next.progress["weekly-daily"]).toBe(3);
    expect(applyMissionEvent(base, { type: "stamina_spent", amount: 900 }, now).progress).toMatchObject({ "daily-stamina": 60, "weekly-stamina": 600 });
  });

  it("일일은 하나를 빠뜨려도, 주간도 하나를 빠뜨려도 마지막 단계에 닿는다", () => {
    for (const period of ["daily", "weekly"] as const) {
      const points = MISSIONS.filter((mission) => mission.period === period).map((mission) => mission.researchPoints).sort((a, b) => a - b);
      expect(points.slice(1).reduce((sum, value) => sum + value, 0)).toBeGreaterThanOrEqual(maxResearchPoints(period));
    }
  });
});
