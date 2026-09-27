import type { ClaimMissionRewardsResponse, GameApi, MissionDto } from "../api/contracts";
import type { MissionPeriod } from "../core/missions";
import type { RewardFrameState } from "./RewardFrame";

/** 표시 모델에서 0 목표 방어와 100% 상한을 끝내 렌더러가 잘못된 비율을 만들지 않게 한다. */
export function missionDisplayModel(mission: MissionDto): MissionDto & { ratio: number; progressLabel: string; state: RewardFrameState; claimable: boolean } {
  const target = Math.max(0, mission.target);
  const progress = Math.max(0, mission.progress);
  const ratio = target === 0 ? (progress > 0 ? 1 : 0) : Math.min(1, progress / target);
  const claimable = !mission.claimed && ratio >= 1;
  return { ...mission, progress, target, ratio, progressLabel: `${progress}/${target}`, state: mission.claimed ? "claimed" : claimable ? "claimable" : "normal", claimable };
}

/** 카드와 아이콘이 같은 수령 경로를 공유하며 진행 중 ID의 중복 요청을 차단한다. */
export class MissionClaimController {
  private readonly pending = new Set<string>();
  constructor(private readonly api: Pick<GameApi, "claimMissionRewards">) {}
  async claim(ids: readonly string[], period?: MissionPeriod, stageIds?: readonly string[]): Promise<ClaimMissionRewardsResponse | undefined> {
    const unique = [...new Set(ids)];
    if (unique.some((id) => this.pending.has(id))) return undefined;
    unique.forEach((id) => this.pending.add(id));
    try {
      // 기존 임무 수령은 인자를 하나만 보내 계약 더블과 실제 HTTP 어댑터의 호환을 보존한다.
      return period === undefined ? await this.api.claimMissionRewards(unique) : await this.api.claimMissionRewards(unique, period, stageIds ? [...stageIds] : undefined);
    }
    finally { unique.forEach((id) => this.pending.delete(id)); }
  }
}

/**
 * 그 기간이 다음에 초기화되기까지 남은 시간. 일일은 다음 UTC 자정, 주간은 다음 UTC 월요일
 * 자정이다 — 서버의 `missionPeriodKeys`와 같은 경계를 쓴다.
 */
export function missionResetRemainingMs(period: MissionPeriod, now: Date): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (period === "weekly") {
    // 다음 날 자정에서부터 월요일까지 더 간다. 오늘이 일요일이면 곧 월요일이다.
    const daysToMonday = (8 - next.getUTCDay()) % 7;
    next.setUTCDate(next.getUTCDate() + daysToMonday);
  }
  return Math.max(0, next.getTime() - now.getTime());
}

/** 남은 시간을 `1일 04:12:09`·`04:12:09`로 적는다. 일 수는 언어와 무관한 약자 없이 수만 붙인다. */
export function formatResetRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86_400);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}D ${clock}` : clock;
}

/**
 * 임무 줄의 순서 — **받을 것 → 달성도가 높은 것 → 받은 것.**
 *
 * 흐르는 목록이라 아래로 내려야 보이는 줄이 생긴다. 다 한 것과 거의 다 한 것이 위에 모여야 손이
 * 스크롤을 덜 하고, 이미 받은 줄은 더 할 일이 없어 맨 아래로 가라앉는다. 같은 무리 안에서는
 * 데이터 순서를 지킨다 — 달성도가 같다고 줄이 매번 뒤섞이면 어디 있던지 다시 찾아야 한다.
 */
export function orderMissions<T extends MissionDto>(missions: readonly T[]): T[] {
  const rank = (mission: T): number => {
    const model = missionDisplayModel(mission);
    return model.claimable ? 0 : model.claimed ? 2 : 1;
  };
  return missions
    .map((mission, index) => ({ mission, index, rank: rank(mission), ratio: missionDisplayModel(mission).ratio }))
    .sort((a, b) => a.rank - b.rank || (a.rank === 1 ? b.ratio - a.ratio : 0) || a.index - b.index)
    .map(({ mission }) => mission);
}

/** 한 기간 목록의 지난 순서와, 그때 줄마다의 상태 서명. */
export interface MissionOrderMemory {
  order: readonly string[];
  signatures: ReadonlyMap<string, string>;
}

/** 줄이 「바뀌었다」를 가르는 서명 — 받을 수 있음 · 받음 · 진행도. 셋 중 하나라도 달라야 자리를 옮긴다. */
export function missionSignature(mission: MissionDto): string {
  const model = missionDisplayModel(mission);
  return `${model.claimable ? 1 : 0}|${mission.claimed ? 1 : 0}|${mission.progress}`;
}

/**
 * **한 번 정한 순서는 지킨다** — 바뀐 줄만 제자리를 다시 찾는다.
 *
 * 탭을 오갈 때마다 `orderMissions`로 처음부터 다시 줄 세우면, 아무것도 바뀌지 않았는데 줄이 데이터
 * 순서에서 정렬 순서로 매번 스르륵 옮겨 가 정신이 사나웠다. 지난 순서(`memory`)가 있으면 서명이 같은
 * 줄은 그 자리 그대로 두고, 새로 생기거나 서명이 바뀐 줄(갱신·완료·수령)만 정렬 기준대로 끼워 넣는다.
 * 지난 순서가 없을 때(처음 연 기간)만 전체를 한 번 줄 세운다.
 */
export function stableOrderMissions<T extends MissionDto>(missions: readonly T[], memory?: MissionOrderMemory): { missions: T[]; memory: MissionOrderMemory } {
  const signatures = new Map(missions.map((mission) => [mission.id, missionSignature(mission)]));
  const remember = (list: T[]): { missions: T[]; memory: MissionOrderMemory } => ({ missions: list, memory: { order: list.map(({ id }) => id), signatures } });
  if (!memory) return remember(orderMissions(missions));
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  const kept = memory.order
    .filter((id) => byId.has(id) && memory.signatures.get(id) === signatures.get(id))
    .map((id) => byId.get(id)!);
  const keptIds = new Set(kept.map(({ id }) => id));
  const moved = orderMissions(missions.filter(({ id }) => !keptIds.has(id)));
  const key = (mission: T): [number, number] => {
    const model = missionDisplayModel(mission);
    const rank = model.claimable ? 0 : model.claimed ? 2 : 1;
    return [rank, rank === 1 ? -model.ratio : 0];
  };
  const after = (a: T, b: T): boolean => {
    const [ra, sa] = key(a); const [rb, sb] = key(b);
    return ra > rb || (ra === rb && sa > sb);
  };
  const list = [...kept];
  for (const mission of moved) {
    const at = list.findIndex((existing) => after(existing, mission));
    if (at < 0) list.push(mission); else list.splice(at, 0, mission);
  }
  return remember(list);
}
