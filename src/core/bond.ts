import type { RelicProgress } from "./types";

/**
 * 유대는 함께한 경험으로 쌓이는 플레이어별 관계 진행이다.
 * 로비에 누구를 세우는지 정하는 애착(favorite)과는 서로 독립된 개념이다.
 */
export const BOND_LEVEL_CAP = 10;

/** 각 레벨에 도달하는 데 필요한 누적 경험치다. 인덱스가 곧 유대 레벨이다. */
export const BOND_TOTAL_XP_BY_LEVEL = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650] as const;

/** 허용된 세 경로만 이름 있는 상수로 노출해 임의 보상 생성을 막는다. */
export const BOND_XP_REWARD = { firstAcquisition: 20, partyVictory: 12, firstLobbyInteraction: 5, firstObservationInterview: 5 } as const;

/**
 * 유대 레벨별 야성 증가 배율.
 *
 * 야성은 벌이 아니라 이 게임의 피버다. 게이지가 차고 터지고 가라앉는 것은 전부 전투가
 * 스스로 하며 플레이어가 그 시점을 고르지 않는다 — 플레이어가 바꿀 수 있는 것은 **얼마나
 * 오래 함께 싸웠는가**뿐이고, 오래 함께 싸운 렐릭일수록 본능을 더 빨리 끌어올린다. 그래서
 * 유대가 높을수록 배율이 **커진다**.
 */
export const BOND_FEROCITY_MULTIPLIER = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5] as const;

export interface BondXpResult { progress: RelicProgress; xpGained: number; levelsGained: number; }

/** 누적 경험치에서 레벨을 다시 계산해 저장값 조작이나 큰 보상도 상한을 넘지 않게 한다. */
export function bondLevelForXp(xp: number): number {
  if (!Number.isInteger(xp) || xp < 0) throw new RangeError("유대 경험치는 0 이상의 정수여야 합니다.");
  let level = 0;
  while (level < BOND_LEVEL_CAP && xp >= BOND_TOTAL_XP_BY_LEVEL[level + 1]) level += 1;
  return level;
}

/** 원본 성장 객체를 변경하지 않고 경험치와 그 결과 레벨을 함께 반환한다. */
export function grantBondXp(progress: RelicProgress, amount: number): BondXpResult {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError("유대 경험치 보상은 0 이상의 정수여야 합니다.");
  const bondXp = Math.min(BOND_TOTAL_XP_BY_LEVEL[BOND_LEVEL_CAP], progress.bondXp + amount);
  const bondLevel = bondLevelForXp(bondXp);
  return { progress: { ...progress, bondXp, bondLevel, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] }, xpGained: bondXp - progress.bondXp, levelsGained: bondLevel - progress.bondLevel };
}

/** UTC 날짜키를 비교해 로비 경험치를 하루 한 번만 확정한다. */
export function grantDailyLobbyBondXp(progress: RelicProgress, utcDate: string): BondXpResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(utcDate)) throw new RangeError("로비 상호작용 날짜가 올바르지 않습니다.");
  if (progress.lastLobbyInteractionDate === utcDate) return { progress: { ...progress, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] }, xpGained: 0, levelsGained: 0 };
  const result = grantBondXp(progress, BOND_XP_REWARD.firstLobbyInteraction);
  return { ...result, progress: { ...result.progress, lastLobbyInteractionDate: utcDate } };
}

/** 전투 엔진이 정적 유대 효과표와 같은 반올림 규칙을 사용하게 한다. */
export function amplifyFerocityGain(amount: number, bondLevel: number): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(bondLevel) || bondLevel < 0) throw new RangeError("야성 증가량과 유대 레벨이 올바르지 않습니다.");
  // 외부 전투 스냅샷에 상한 초과 값이 와도 최대 해금 효과로 안전하게 제한한다.
  return Math.max(0, Math.round(amount * BOND_FEROCITY_MULTIPLIER[Math.min(BOND_LEVEL_CAP, bondLevel)]));
}
