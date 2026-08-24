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
}

/** 화면과 서버가 함께 쓰는 정적 임무 규격이다. */
export interface MissionDefinition {
  id: string;
  period: MissionPeriod;
  title: string;
  target: number;
  rewardCheesecake: number;
  event: MissionEvent["type"];
}

// 운영 데이터가 붙기 전의 최소 임무 묶음이며, 보상과 목표를 한곳에서만 정의한다.
export const MISSIONS: readonly MissionDefinition[] = [
  { id: "daily-battle", period: "daily", title: "전투 완료 1회", target: 1, rewardCheesecake: 20, event: "battle_completed" },
  // 저장 ID는 기존 세이브와 호환하되 제목과 이벤트는 연구소의 확률형 획득임을 드러낸다.
  { id: "daily-excavate", period: "daily", title: "연구소 캐릭터 연구 1회", target: 1, rewardCheesecake: 20, event: "relic_research_completed" },
  { id: "daily-salary", period: "daily", title: "급여 1회", target: 1, rewardCheesecake: 20, event: "salary_given" },
  { id: "daily-lobby", period: "daily", title: "로비 교류 1회", target: 1, rewardCheesecake: 20, event: "lobby_interaction" },
  { id: "weekly-battle", period: "weekly", title: "전투 완료 5회", target: 5, rewardCheesecake: 100, event: "battle_completed" },
  { id: "weekly-excavate", period: "weekly", title: "연구소 캐릭터 연구 10회", target: 10, rewardCheesecake: 100, event: "relic_research_completed" },
];

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
  const keys = missionPeriodKeys(now);
  const dailyChanged = state.dailyKey !== keys.dailyKey;
  const weeklyChanged = state.weeklyKey !== keys.weeklyKey;
  if (!dailyChanged && !weeklyChanged) return { ...state, progress: { ...state.progress }, claimedIds: [...state.claimedIds] };
  const resetIds = new Set(MISSIONS.filter((mission) => (mission.period === "daily" ? dailyChanged : weeklyChanged)).map((mission) => mission.id));
  return {
    ...keys,
    progress: Object.fromEntries(Object.entries(state.progress).filter(([id]) => !resetIds.has(id))),
    claimedIds: state.claimedIds.filter((id) => !resetIds.has(id)),
  };
}

/** 하나의 성공 이벤트를 관련 임무에 한 번만 반영하고 목표 이상은 잘라 낸다. */
export function applyMissionEvent(state: MissionState, event: MissionEvent, now: Date): MissionState {
  const next = normalizeMissions(state, now);
  // 패배는 전투 완료 임무의 성공 행동으로 세지 않는다.
  if (event.type === "battle_completed" && !event.victory) return next;
  const amount = event.type === "relic_research_completed" || event.type === "salary_given" ? event.count : 1;
  for (const mission of MISSIONS) {
    if (mission.event === event.type) next.progress[mission.id] = Math.min(mission.target, (next.progress[mission.id] ?? 0) + amount);
  }
  return next;
}

/** 완료했지만 아직 수령하지 않은 임무만 계산한다. */
export function claimableMissionIds(state: MissionState): string[] {
  return MISSIONS.filter((mission) => (state.progress[mission.id] ?? 0) >= mission.target && !state.claimedIds.includes(mission.id)).map((mission) => mission.id);
}
