/** 조력자 대여가 허용되는 콘텐츠 분류다. 경쟁·고난도 콘텐츠는 의도적으로 포함하지 않는다. */
export type HelperContentKind = "story_normal" | "resource" | "daily_restoration" | "story_hard" | "ranked" | "raid";

/** 하루에 다른 연구원의 애착 렐릭을 빌릴 수 있는 최대 횟수다. */
export const DAILY_HELPER_LIMIT = 3;

/** 한 번의 정상 대여가 성립했을 때 대여자와 제공자 양쪽에 지급하는 친구 포인트다. */
export const FRIEND_POINTS_PER_RENTAL = 10;

/**
 * 조력자는 성장 격차를 메우는 편의 수단일 뿐, 고난도 클리어 조건이 되어서는 안 된다.
 * 따라서 일반 스토리와 반복 재료 콘텐츠에서만 한 슬롯을 보조할 수 있다.
 */
export function canUseFriendHelper(kind: HelperContentKind): boolean {
  return kind === "story_normal" || kind === "resource" || kind === "daily_restoration";
}

/** 서버가 기록한 오늘 사용량을 기준으로 대여 가능 여부와 남은 횟수를 한 규칙으로 계산한다. */
export function helperRentalAvailability(usedToday: number): { allowed: boolean; remaining: number } {
  const normalized = Math.max(0, Math.floor(usedToday));
  const remaining = Math.max(0, DAILY_HELPER_LIMIT - normalized);
  return { allowed: remaining > 0, remaining };
}
