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
 * 유대 한 레벨이 올리는 능력치(%) — 오각형 다섯(체력·방어·저항·공격·주문력)에 레벨마다 1%씩, 10레벨이면 10%다.
 *
 * 예전에는 유대가 야성이 차는 속도를 최대 +50%까지 올렸다. 응태 결정(2026-11-28)으로 걷어 내고 능력치로 옮겼다 —
 * 폭주 시각이 유대 하나로 크게 당겨지면 같은 편성도 얼마나 오래 함께했는지에 따라 판이 통째로 갈렸고, 그 몫은
 * 화면의 오각형에 서지 않았다. **성장은 오각형 다섯만 올린다**는 규칙(공명·레벨과 같은 축)을 그대로 따르고,
 * 공명과 더해서 한 번에 곱한다(`calculateFinalStats`). 대인전에서도 그대로 든다 — 꺼지는 것은 공명뿐이다.
 */
export const BOND_STAT_PERCENT_PER_LEVEL = 1;

/** 그 유대 레벨이 오각형 다섯에 더하는 몫(%). 상한을 넘긴 값은 상한 몫으로 자른다. */
export function bondStatPercent(bondLevel: number): number {
  if (!Number.isFinite(bondLevel) || bondLevel <= 0) return 0;
  return Math.min(BOND_LEVEL_CAP, Math.floor(bondLevel)) * BOND_STAT_PERCENT_PER_LEVEL;
}

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
