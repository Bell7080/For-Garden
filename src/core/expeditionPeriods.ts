import { expeditionWeekKey } from "./expeditionBoss";
import type { ExpeditionState } from "../state/session";

/**
 * 원정의 두 주기 — **하루 한 판**과 **한 주의 최고 기록**.
 *
 * 원정은 하루에 한 번 떠날 수 있고(`EXPEDITION_DAILY_POLICY`), 점수는 합치지 않고 **그 주의 한 판
 * 최고 점수**만 남긴다 — 두세 판의 합은 얼마나 잘 싸웠는지가 아니라 몇 번 들어왔는지를 말했다.
 * 한 주가 끝나면 그 주의 최고 기록이 **순위 보상 대기**(`pendingRankReward`)로 옮겨 가고, 서버가
 * 순위를 매겨 우편으로 보낸다.
 *
 * 화면(`ExpeditionManager`)과 서버(`FakeServer`)가 **같은 함수**로 주기를 넘긴다 — 어느 쪽이 먼저
 * 넘기든 지난주 기록이 순위 보상으로 옮겨 가야 한다. 한쪽만 주를 넘기며 최고 기록을 0으로 지우면
 * 그 주의 순위 보상이 사라진다.
 */
export function expeditionDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** 옛 저장·테스트 고정값이 빠뜨린 칸을 채운다. */
export function normalizeExpeditionState(expedition: Partial<ExpeditionState> & { playsThisWeek?: number }): ExpeditionState {
  return {
    weekKey: expedition.weekKey ?? "",
    dayKey: expedition.dayKey ?? "",
    playsToday: Math.max(0, Math.floor(expedition.playsToday ?? 0)),
    bestScore: Math.max(0, Math.floor(expedition.bestScore ?? 0)),
    bestAchievedAt: expedition.bestAchievedAt ?? "",
    allTimeBestScore: Math.max(0, Math.floor(expedition.allTimeBestScore ?? expedition.bestScore ?? 0)),
    claimedRewardStageIds: [...(expedition.claimedRewardStageIds ?? [])],
    pendingRankReward: expedition.pendingRankReward ? { ...expedition.pendingRankReward } : null,
    lastParty: [...(expedition.lastParty ?? [])],
    run: expedition.run ?? null,
  };
}

/**
 * 지금 시각까지 주기를 넘긴다. 바뀐 것이 없으면 같은 값을 돌려준다(부르는 쪽이 저장 여부를 가른다).
 *
 * 주가 넘어가면 지난주 최고 기록이 순위 보상 대기로 옮겨 가고, 최고 기록·보상 길 수령이 비워진다.
 * 이미 받지 않은 대기가 있으면 **덮지 않는다** — 두 주를 건너뛰고 들어온 사람도 앞선 주의 보상을 잃지 않는다.
 */
export function rollExpeditionPeriods(expedition: ExpeditionState, now: Date): ExpeditionState {
  const weekKey = expeditionWeekKey(now);
  const dayKey = expeditionDayKey(now);
  let next = expedition;
  if (next.dayKey !== dayKey) next = { ...next, dayKey, playsToday: 0 };
  if (next.weekKey !== weekKey) {
    const pending = next.pendingRankReward
      ?? (next.weekKey && next.bestScore > 0 ? { weekKey: next.weekKey, score: next.bestScore, achievedAt: next.bestAchievedAt } : null);
    next = { ...next, weekKey, bestScore: 0, bestAchievedAt: "", claimedRewardStageIds: [], pendingRankReward: pending };
  }
  return next;
}
