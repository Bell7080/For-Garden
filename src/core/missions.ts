/** 서버가 수집한 도메인 행동을 일일·주간 임무 진행도로 바꾸는 순수 규칙이다. */

/** 임무 갱신을 일으키는, API 처리 성공 이후의 도메인 이벤트다. */
export type MissionEvent =
  | { type: "battle_completed"; victory: boolean }
  | { type: "relic_research_completed"; count: number }
  | { type: "salary_given"; count: number }
  | { type: "lobby_interaction" };

export type MissionPeriod = "daily" | "weekly";

/** 저장 및 전송에 Set을 쓰지 않는 임무 진행 스냅샷이다. */
export interface MissionState {
  dailyKey: string;
  weeklyKey: string;
  progress: Record<string, number>;
  claimedIds: string[];
  /** 임무가 처음 완료되는 순간 확정된 기간별 연구도다. */
  researchPoints: Record<MissionPeriod, number>;
  /** 연구도 단계 보상이 실제 지급된 ID다. */
  claimedResearchStageIds: string[];
}

/** 화면과 서버가 함께 쓰는 정적 임무 규격이다. */
export interface MissionDefinition {
  id: string;
  period: MissionPeriod;
  title: string;
  target: number;
  rewardCheesecake: number;
  /** 목표를 처음 달성할 때 즉시 확정되며 보상 수령 여부와 무관한 연구도다. */
  researchPoints: number;
  event: MissionEvent["type"];
}

// 운영 데이터가 붙기 전의 최소 임무 묶음이며, 보상과 목표를 한곳에서만 정의한다.
export const MISSIONS: readonly MissionDefinition[] = [
  { id: "daily-battle", period: "daily", title: "전투 완료 1회", target: 1, rewardCheesecake: 20, researchPoints: 20, event: "battle_completed" },
  // 저장 ID는 기존 세이브와 호환하되 제목과 이벤트는 연구소의 확률형 획득임을 드러낸다.
  { id: "daily-excavate", period: "daily", title: "연구소 캐릭터 연구 1회", target: 1, rewardCheesecake: 20, researchPoints: 20, event: "relic_research_completed" },
  { id: "daily-salary", period: "daily", title: "급여 1회", target: 1, rewardCheesecake: 20, researchPoints: 20, event: "salary_given" },
  { id: "daily-lobby", period: "daily", title: "로비 교류 1회", target: 1, rewardCheesecake: 20, researchPoints: 20, event: "lobby_interaction" },
  { id: "weekly-battle", period: "weekly", title: "전투 완료 5회", target: 5, rewardCheesecake: 100, researchPoints: 60, event: "battle_completed" },
  { id: "weekly-excavate", period: "weekly", title: "연구소 캐릭터 연구 10회", target: 10, rewardCheesecake: 100, researchPoints: 60, event: "relic_research_completed" },
];

/** 두 기간이 함께 쓰는 임계값과 보상을 이 표 하나에서만 운영한다. */
export const RESEARCH_REWARD_STAGES = [20, 40, 60, 80, 100, 120].map((threshold, index) => ({
  id: `research-${threshold}`,
  threshold,
  rewardCheesecake: (index + 1) * 10,
})) as readonly { id: string; threshold: number; rewardCheesecake: number }[];
export const MAX_RESEARCH_POINTS = RESEARCH_REWARD_STAGES.at(-1)?.threshold ?? 0;

/** 기간을 ID에 포함해 일일·주간 단계 수령 기록이 충돌하지 않게 한다. */
export function researchStageClaimId(period: MissionPeriod, stageId: string): string { return `${period}:${stageId}`; }

/** UTC 날짜와 그 날짜가 속한 월요일을 안정적인 기간 키로 만든다. */
export function missionPeriodKeys(now: Date): { dailyKey: string; weeklyKey: string } {
  const dailyKey = now.toISOString().slice(0, 10);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysFromMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  return { dailyKey, weeklyKey: monday.toISOString().slice(0, 10) };
}

/** UTC 기간이 달라진 범위만 초기화하고 다른 범위의 진행은 보존한다. */
export function normalizeMissions(state: MissionState, now: Date): MissionState {
  // 호출 경계의 구버전/테스트 스냅샷도 마이그레이션과 같은 안전 기본값으로 받아들인다.
  const researchPoints = state.researchPoints ?? { daily: 0, weekly: 0 };
  const claimedResearchStageIds = state.claimedResearchStageIds ?? [];
  const keys = missionPeriodKeys(now);
  const dailyChanged = state.dailyKey !== keys.dailyKey;
  const weeklyChanged = state.weeklyKey !== keys.weeklyKey;
  if (!dailyChanged && !weeklyChanged) return { ...state, progress: { ...state.progress }, claimedIds: [...state.claimedIds], researchPoints: { ...researchPoints }, claimedResearchStageIds: [...claimedResearchStageIds] };
  const resetIds = new Set(MISSIONS.filter((mission) => (mission.period === "daily" ? dailyChanged : weeklyChanged)).map((mission) => mission.id));
  return {
    ...keys,
    progress: Object.fromEntries(Object.entries(state.progress).filter(([id]) => !resetIds.has(id))),
    claimedIds: state.claimedIds.filter((id) => !resetIds.has(id)),
    researchPoints: {
      daily: dailyChanged ? 0 : researchPoints.daily,
      weekly: weeklyChanged ? 0 : researchPoints.weekly,
    },
    claimedResearchStageIds: claimedResearchStageIds.filter((id) => !(dailyChanged && id.startsWith("daily:")) && !(weeklyChanged && id.startsWith("weekly:"))),
  };
}

/** 하나의 성공 이벤트를 관련 임무에 한 번만 반영하고 목표 이상은 잘라 낸다. */
export function applyMissionEvent(state: MissionState, event: MissionEvent, now: Date): MissionState {
  const next = normalizeMissions(state, now);
  // 패배는 전투 완료 임무의 성공 행동으로 세지 않는다.
  if (event.type === "battle_completed" && !event.victory) return next;
  const amount = event.type === "relic_research_completed" || event.type === "salary_given" ? event.count : 1;
  for (const mission of MISSIONS) {
    if (mission.event !== event.type) continue;
    const previous = next.progress[mission.id] ?? 0;
    const progress = Math.min(mission.target, previous + amount);
    next.progress[mission.id] = progress;
    // 연구도는 완료 전→완료 전이에서만 확정해 이벤트 재처리나 보상 재요청으로 오르지 않는다.
    if (previous < mission.target && progress >= mission.target) next.researchPoints[mission.period] = Math.min(MAX_RESEARCH_POINTS, next.researchPoints[mission.period] + mission.researchPoints);
  }
  return next;
}

/** 선택한 달성 단계만 한 번 수령 표시하고 실제 지급할 치즈케이크 합계를 함께 반환한다. */
export function claimResearchStages(state: MissionState, period: MissionPeriod, stageIds?: readonly string[]): { state: MissionState; claimedStageIds: string[]; cheesecakeEarned: number } {
  const requested = stageIds ?? RESEARCH_REWARD_STAGES.map(({ id }) => id);
  const claimedStageIds = [...new Set(requested)].filter((id) => {
    const stage = RESEARCH_REWARD_STAGES.find((candidate) => candidate.id === id);
    return stage !== undefined && state.researchPoints[period] >= stage.threshold && !state.claimedResearchStageIds.includes(researchStageClaimId(period, id));
  });
  const ids = claimedStageIds.map((id) => researchStageClaimId(period, id));
  return {
    state: { ...state, progress: { ...state.progress }, claimedIds: [...state.claimedIds], researchPoints: { ...state.researchPoints }, claimedResearchStageIds: [...state.claimedResearchStageIds, ...ids] },
    claimedStageIds,
    cheesecakeEarned: claimedStageIds.reduce((sum, id) => sum + (RESEARCH_REWARD_STAGES.find((stage) => stage.id === id)?.rewardCheesecake ?? 0), 0),
  };
}

/** 완료했지만 아직 수령하지 않은 임무만 계산한다. */
export function claimableMissionIds(state: MissionState): string[] {
  return MISSIONS.filter((mission) => (state.progress[mission.id] ?? 0) >= mission.target && !state.claimedIds.includes(mission.id)).map((mission) => mission.id);
}
