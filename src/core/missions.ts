import { registerDataText } from "../i18n";
import type { WalletItemKey } from "../data/items";

/** 서버가 수집한 도메인 행동을 일일·주간 임무 진행도로 바꾸는 순수 규칙이다. */

/** 임무 갱신을 일으키는, API 처리 성공 이후의 도메인 이벤트다. */
export type MissionEvent =
  | { type: "battle_completed"; victory: boolean }
  | { type: "relic_research_completed"; count: number }
  | { type: "salary_given"; count: number }
  | { type: "lobby_interaction" }
  /** 스테미나를 쓰는 모든 입장이 지나는 `FakeServer.spendStamina` 한 곳에서만 난다. */
  | { type: "stamina_spent"; amount: number }
  | { type: "excavation_harvested" }
  | { type: "interaction_dispatched" }
  /** 일일 임무를 수령한 수. 주간 임무가 "매일 들어와 끝냈는가"를 세는 데 쓴다. */
  | { type: "daily_mission_claimed"; count: number };

export type MissionPeriod = "daily" | "weekly";

/** 임무와 연구도 단계가 주는 것. 지갑 한 칸과 그 양이다. */
export interface MissionReward {
  currency: WalletItemKey;
  amount: number;
}

/** 저장 및 전송에 Set을 쓰지 않는 임무 진행 스냅샷이다. */
export interface MissionState {
  dailyKey: string;
  weeklyKey: string;
  progress: Record<string, number>;
  claimedIds: string[];
  /** 임무를 수령하는 순간 오른 기간별 연구도다. */
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
  reward: MissionReward;
  /** 수령할 때 오르는 연구도다. */
  researchPoints: number;
  event: MissionEvent["type"];
}

/*
 * **일일은 가볍게, 주간은 한 주를 돌았는가를 센다.**
 *
 * 일일 여섯 개가 20씩 — 다섯만 끝내도 연구도가 100에 닿는다. 하나쯤 빠뜨려도 마지막 단계까지
 * 가게 둔 것이다. 주간은 일일을 한 번 더 세지 않고, 한 주에 걸쳐야 끝나는 양(전투 20회·스테미나
 * 600)과 **일일 임무를 며칠 끝냈는가**를 센다. 여섯 개 합이 600이라 역시 하나쯤 남겨도 500에
 * 닿는다.
 *
 * 저장 ID는 기존 세이브와 호환한다(`daily-excavate`는 연구소의 확률형 획득이다).
 */
export const MISSIONS: readonly MissionDefinition[] = [
  { id: "daily-battle", period: "daily", title: "전투 승리 1회", target: 1, reward: { currency: "gold", amount: 5_000 }, researchPoints: 20, event: "battle_completed" },
  { id: "daily-excavate", period: "daily", title: "연구소 캐릭터 연구 1회", target: 1, reward: { currency: "gems", amount: 10 }, researchPoints: 20, event: "relic_research_completed" },
  { id: "daily-salary", period: "daily", title: "급여 1회", target: 1, reward: { currency: "cheesecake", amount: 20 }, researchPoints: 20, event: "salary_given" },
  { id: "daily-lobby", period: "daily", title: "로비 교류 1회", target: 1, reward: { currency: "gold", amount: 3_000 }, researchPoints: 20, event: "lobby_interaction" },
  { id: "daily-stamina", period: "daily", title: "스테미나 60 사용", target: 60, reward: { currency: "cheesecake", amount: 30 }, researchPoints: 20, event: "stamina_spent" },
  { id: "daily-harvest", period: "daily", title: "발굴 수확 1회", target: 1, reward: { currency: "gems", amount: 10 }, researchPoints: 20, event: "excavation_harvested" },
  { id: "weekly-daily", period: "weekly", title: "일일 임무 20회 완료", target: 20, reward: { currency: "gems", amount: 50 }, researchPoints: 150, event: "daily_mission_claimed" },
  { id: "weekly-battle", period: "weekly", title: "전투 승리 20회", target: 20, reward: { currency: "gold", amount: 30_000 }, researchPoints: 100, event: "battle_completed" },
  { id: "weekly-excavate", period: "weekly", title: "연구소 캐릭터 연구 10회", target: 10, reward: { currency: "fossil", amount: 150 }, researchPoints: 100, event: "relic_research_completed" },
  { id: "weekly-stamina", period: "weekly", title: "스테미나 600 사용", target: 600, reward: { currency: "cheesecake", amount: 150 }, researchPoints: 100, event: "stamina_spent" },
  { id: "weekly-dispatch", period: "weekly", title: "교류 파견 5회", target: 5, reward: { currency: "dnaFragments", amount: 10 }, researchPoints: 100, event: "interaction_dispatched" },
  { id: "weekly-salary", period: "weekly", title: "급여 10회", target: 10, reward: { currency: "cheesecake", amount: 100 }, researchPoints: 50, event: "salary_given" },
];

/**
 * 임무 제목을 언어별로 덮어쓸 수 있게 등록한다.
 *
 * 정적 콘텐츠와 같은 경계를 쓰는 이유는 이 표가 **운영 중 늘어나는 목록**이기 때문이다 —
 * 한국어는 여기 그대로 두고 다른 언어만 임무 ID로 덮는다.
 */
for (const mission of MISSIONS) {
  registerDataText(mission, "title", `mission.${mission.id}.title`);
}

/** 연구도 단계 한 칸 — 그 임계값에 닿으면 받는 보상 묶음이다. */
export interface ResearchRewardStage {
  id: string;
  threshold: number;
  rewards: readonly MissionReward[];
}

/*
 * **단계 보상은 한 가지 재화로 채우지 않는다.** 여섯 칸이 전부 치즈케이크였을 때는 게이지를
 * 채워도 무엇을 향해 가는지가 그림에서 읽히지 않았다. 앞 칸은 흔한 것(골드·치즈케이크),
 * 뒤로 갈수록 귀한 것(다이아·화석·DNA)이고 **마지막 칸이 가장 크다** — 게이지 끝의 액자가
 * 그 기간의 목표가 된다.
 */
export const RESEARCH_REWARD_STAGES: Readonly<Record<MissionPeriod, readonly ResearchRewardStage[]>> = {
  daily: [
    { id: "research-20", threshold: 20, rewards: [{ currency: "gold", amount: 10_000 }] },
    { id: "research-40", threshold: 40, rewards: [{ currency: "cheesecake", amount: 30 }] },
    { id: "research-60", threshold: 60, rewards: [{ currency: "gems", amount: 20 }] },
    { id: "research-80", threshold: 80, rewards: [{ currency: "fossil", amount: 30 }] },
    { id: "research-100", threshold: 100, rewards: [{ currency: "gems", amount: 50 }, { currency: "cheesecake", amount: 50 }] },
  ],
  weekly: [
    { id: "research-100", threshold: 100, rewards: [{ currency: "gold", amount: 50_000 }] },
    { id: "research-200", threshold: 200, rewards: [{ currency: "cheesecake", amount: 150 }] },
    { id: "research-300", threshold: 300, rewards: [{ currency: "gems", amount: 100 }] },
    { id: "research-400", threshold: 400, rewards: [{ currency: "dnaFragments", amount: 20 }] },
    { id: "research-500", threshold: 500, rewards: [{ currency: "gems", amount: 300 }, { currency: "fossil", amount: 150 }] },
  ],
};

/** 기간마다 게이지의 끝 — 마지막 단계의 임계값이다. */
export function maxResearchPoints(period: MissionPeriod): number {
  return RESEARCH_REWARD_STAGES[period].at(-1)?.threshold ?? 0;
}

/** 같은 재화를 한 줄로 모은다. 영수증이 같은 골드를 두 칸에 세우지 않게 한다. */
export function mergeMissionRewards(rewards: readonly MissionReward[]): MissionReward[] {
  const merged = new Map<WalletItemKey, number>();
  for (const { currency, amount } of rewards) if (amount > 0) merged.set(currency, (merged.get(currency) ?? 0) + amount);
  return [...merged].map(([currency, amount]) => ({ currency, amount }));
}

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
  const amount = "count" in event ? event.count : "amount" in event ? event.amount : 1;
  if (amount <= 0) return next;
  for (const mission of MISSIONS) {
    if (mission.event !== event.type) continue;
    next.progress[mission.id] = Math.min(mission.target, (next.progress[mission.id] ?? 0) + amount);
  }
  return next;
}

/** 선택한 달성 단계만 한 번 수령 표시하고 실제 지급할 보상을 함께 반환한다. */
export function claimResearchStages(state: MissionState, period: MissionPeriod, stageIds?: readonly string[]): { state: MissionState; claimedStageIds: string[]; rewards: MissionReward[] } {
  const stages = RESEARCH_REWARD_STAGES[period];
  const requested = stageIds ?? stages.map(({ id }) => id);
  const claimedStageIds = [...new Set(requested)].filter((id) => {
    const stage = stages.find((candidate) => candidate.id === id);
    return stage !== undefined && state.researchPoints[period] >= stage.threshold && !state.claimedResearchStageIds.includes(researchStageClaimId(period, id));
  });
  const ids = claimedStageIds.map((id) => researchStageClaimId(period, id));
  return {
    state: { ...state, progress: { ...state.progress }, claimedIds: [...state.claimedIds], researchPoints: { ...state.researchPoints }, claimedResearchStageIds: [...state.claimedResearchStageIds, ...ids] },
    claimedStageIds,
    rewards: mergeMissionRewards(claimedStageIds.flatMap((id) => stages.find((stage) => stage.id === id)?.rewards ?? [])),
  };
}

/**
 * 임무 보상을 수령할 때 함께 오르는 연구도.
 *
 * **완료가 아니라 수령이 연구도를 올린다.** 완료하는 순간 게이지가 저 혼자 차오르면, 정작
 * 보상을 받는 손에는 아무 일도 일어나지 않아 두 값이 따로 노는 것처럼 보인다. 같은 임무를 두
 * 번 수령할 수 없으므로(`claimedIds`) 이 합계도 한 번만 오른다.
 */
export function researchPointsForClaim(claimedMissionIds: readonly string[]): Record<MissionPeriod, number> {
  const gained: Record<MissionPeriod, number> = { daily: 0, weekly: 0 };
  for (const id of new Set(claimedMissionIds)) {
    const mission = MISSIONS.find((candidate) => candidate.id === id);
    if (mission) gained[mission.period] += mission.researchPoints;
  }
  return gained;
}

/** 수령한 임무의 연구도를 상한 안에서 더한 새 상태를 만든다. */
export function addResearchPoints(state: MissionState, gained: Record<MissionPeriod, number>): MissionState {
  return {
    ...state,
    progress: { ...state.progress },
    claimedIds: [...state.claimedIds],
    claimedResearchStageIds: [...state.claimedResearchStageIds],
    researchPoints: {
      daily: Math.min(maxResearchPoints("daily"), state.researchPoints.daily + gained.daily),
      weekly: Math.min(maxResearchPoints("weekly"), state.researchPoints.weekly + gained.weekly),
    },
  };
}

/** 완료했지만 아직 수령하지 않은 임무만 계산한다. */
export function claimableMissionIds(state: MissionState): string[] {
  return MISSIONS.filter((mission) => (state.progress[mission.id] ?? 0) >= mission.target && !state.claimedIds.includes(mission.id)).map((mission) => mission.id);
}
