import { ACHIEVEMENT_SERIES } from "../data/achievements";
import { LIFETIME_COUNT_CAP } from "./missions";
import { ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { NEWBIE_GROWTH_CLAIM_IDS } from "../data/newbieGrowth";

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
  /** 신규 7일 성장 가이드에서 받은 목표·마디 ID(`data/newbieGrowth.ts`). 선택 필드다. */
  growth?: string[];
  /** 애착 렐릭을 직접 정한 적이 있다 — 기본 애착은 세지 않으므로 `setFavorite`이 처음 바꿀 때 켠다. */
  favoriteChosen?: true;
  /** 길드에 든 적이 있다 — 탈퇴해도 목표가 되돌아가지 않게 서버가 처음 본 순간 굳힌다. */
  guildJoined?: true;
  /** 계정 첫 결제 선물을 받았다(`FIRST_PAYMENT_GIFT`) — 어떤 상품이든 플랫폼 결제가 처음 확정된 순간 한 번 켠다. */
  firstPaymentGift?: true;
  /** 레벨·업적이 아니라 선물로 연 한정 프로필 테두리 ID(첫 결제 · 시즌 패스). */
  giftFrames?: string[];
}

/** 선물로만 여는 한정 테두리 ID. `data/profileFrames.ts`의 `unlockGift` 테두리와 같아야 한다(`profileFrames.test`). */
export const GIFT_FRAME_IDS: ReadonlySet<string> = new Set(["patron", "season"]);

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
  const giftFrames = Array.isArray(source.giftFrames) ? [...new Set(source.giftFrames.filter((id): id is string => typeof id === "string" && GIFT_FRAME_IDS.has(id)))] : [];
  const growth = Array.isArray(source.growth) ? [...new Set(source.growth.filter((id): id is string => typeof id === "string" && NEWBIE_GROWTH_CLAIM_IDS.has(id)))] : [];
  return {
    claimed, goldPeak: Math.min(LIFETIME_COUNT_CAP, whole(source.goldPeak)), ...(ancientFloorPeak > 0 ? { ancientFloorPeak } : {}),
    ...(growth.length > 0 ? { growth } : {}), ...(source.favoriteChosen === true ? { favoriteChosen: true as const } : {}), ...(source.guildJoined === true ? { guildJoined: true as const } : {}),
    ...(source.firstPaymentGift === true ? { firstPaymentGift: true as const } : {}), ...(giftFrames.length > 0 ? { giftFrames } : {}),
  };
}

export function isValidAchievementState(value: unknown): value is AchievementState {
  if (!value || typeof value !== "object") return false;
  const state = value as AchievementState;
  if (!Number.isInteger(state.goldPeak) || state.goldPeak < 0) return false;
  if (state.ancientFloorPeak !== undefined && (!Number.isInteger(state.ancientFloorPeak) || state.ancientFloorPeak < 0 || state.ancientFloorPeak > ANCIENT_STRATA_MAX_FLOOR)) return false;
  if (state.growth !== undefined && (!Array.isArray(state.growth) || state.growth.some((id) => typeof id !== "string" || !NEWBIE_GROWTH_CLAIM_IDS.has(id)))) return false;
  if (state.favoriteChosen !== undefined && state.favoriteChosen !== true) return false;
  if (state.guildJoined !== undefined && state.guildJoined !== true) return false;
  if (state.firstPaymentGift !== undefined && state.firstPaymentGift !== true) return false;
  if (state.giftFrames !== undefined && (!Array.isArray(state.giftFrames) || state.giftFrames.some((id) => typeof id !== "string" || !GIFT_FRAME_IDS.has(id)))) return false;
  if (!state.claimed || typeof state.claimed !== "object") return false;
  return Object.entries(state.claimed).every(([id, count]) => {
    const series = ACHIEVEMENT_SERIES.find((candidate) => candidate.id === id);
    return series !== undefined && Number.isInteger(count) && count >= 0 && count <= series.tiers.length;
  });
}

