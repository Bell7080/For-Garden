import { DAILY_RESTORATION } from "../data/stages";
import type { DailyContentState } from "../state/session";

/** 서버 시각을 UTC 일자 키로 고정해 로컬 시간대 변경으로 입장 횟수를 되돌리지 못하게 한다. */
export function utcDateKey(now: Date): string {
  if (Number.isNaN(now.getTime())) throw new RangeError("유효한 서버 날짜가 필요합니다.");
  return now.toISOString().slice(0, 10);
}

/** UTC 키가 달라질 때만 일일 입장 상태를 초기화하며 원본 저장 상태는 변경하지 않는다. */
export function normalizeDailyContent(state: DailyContentState, serverNow: Date): DailyContentState {
  const date = utcDateKey(serverNow);
  return state.date === date
    ? { ...state, completedIds: [...state.completedIds], claimedRewardIds: [...state.claimedRewardIds] }
    : { date, restorationEntries: 0, completedIds: [], claimedRewardIds: [] };
}

/** 일일 복원 입장 한 번을 소비한다. 보상 지급과 횟수 변경은 API가 같은 저장 처리로 확정한다. */
export function consumeRestorationEntry(state: DailyContentState, serverNow: Date): DailyContentState {
  const normalized = normalizeDailyContent(state, serverNow);
  if (normalized.restorationEntries >= DAILY_RESTORATION.maxEntriesPerUtcDay) throw new RangeError("오늘의 일일 복원 입장 횟수를 모두 사용했습니다.");
  return { ...normalized, restorationEntries: normalized.restorationEntries + 1 };
}
