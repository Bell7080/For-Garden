import { ACHIEVEMENT_SERIES } from "../data/achievements";
import { LIFETIME_COUNT_CAP } from "./missions";
import { ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";

/*
 * 업적 저장 모양만 따로 둔다 — `state/session.ts`가 읽는 파일이라 렐릭·스테이지 표처럼 무거운 데이터를
 * 끌고 오지 않게 한다(판정 규칙은 `core/achievements.ts`).
 */

/** 저장 모양. 업적마다 **몇 단계를 받았나** 하나와, 지갑만으로는 알 수 없는 최고 보유 골드다. */
export interface AchievementState {
  claimed: Record<string, number>;
  /**
   * 이제껏 가장 많이 들고 있던 골드. 지금 골드로 재면 강화에 쓰는 순간 업적이 뒤로 가므로, 모든 쓰기가
   * 지나는 저장 경계(`FakeServer.persist`)가 최고치만 올린다.
   */
  goldPeak: number;
  /** 월간 지층 초기화와 무관하게 유지하는 최고 도달 기록. 구 저장은 현재 층으로 보충한다. */
  ancientFloorPeak?: number;
}

export function createEmptyAchievementState(): AchievementState { return { claimed: {}, goldPeak: 0 }; }

const whole = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? value as number : 0);

/** 손상되거나 사라진 업적 ID·단계 수를 걸러 낸다(받은 단계 수는 그 업적의 단계 수를 넘지 않는다). */
export function normalizeAchievementState(value: unknown): AchievementState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof AchievementState, unknown>>;
  const claimedSource = source.claimed && typeof source.claimed === "object" ? source.claimed as Record<string, unknown> : {};
  const claimed: Record<string, number> = {};
  for (const series of ACHIEVEMENT_SERIES) {
    const count = Math.min(series.tiers.length, whole(claimedSource[series.id]));
    if (count > 0) claimed[series.id] = count;
  }
  const ancientFloorPeak = Math.min(ANCIENT_STRATA_MAX_FLOOR, whole(source.ancientFloorPeak));
  return { claimed, goldPeak: Math.min(LIFETIME_COUNT_CAP, whole(source.goldPeak)), ...(ancientFloorPeak > 0 ? { ancientFloorPeak } : {}) };
}

export function isValidAchievementState(value: unknown): value is AchievementState {
  if (!value || typeof value !== "object") return false;
  const state = value as AchievementState;
  if (!Number.isInteger(state.goldPeak) || state.goldPeak < 0) return false;
  if (state.ancientFloorPeak !== undefined && (!Number.isInteger(state.ancientFloorPeak) || state.ancientFloorPeak < 0 || state.ancientFloorPeak > ANCIENT_STRATA_MAX_FLOOR)) return false;
  if (!state.claimed || typeof state.claimed !== "object") return false;
  return Object.entries(state.claimed).every(([id, count]) => {
    const series = ACHIEVEMENT_SERIES.find((candidate) => candidate.id === id);
    return series !== undefined && Number.isInteger(count) && count >= 0 && count <= series.tiers.length;
  });
}

