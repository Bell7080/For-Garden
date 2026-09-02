/** Phaser/플랫폼과 무관한 스테미나 운영 상수다. 운영 조정은 이 표만 변경한다. */
export const BASE_STAMINA_MAX = 120;
export const STAMINA_PER_RESEARCH_LEVEL = 2;
export const ABSOLUTE_STAMINA_MAX = 240;
export const STAMINA_REGEN_INTERVAL_MS = 5 * 60 * 1000;

/** 연구 레벨을 안전한 정수로 정규화한 뒤 동적 최대치를 계산한다. */
export function staminaMaxForResearchLevel(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  return Math.min(ABSOLUTE_STAMINA_MAX, BASE_STAMINA_MAX + safeLevel * STAMINA_PER_RESEARCH_LEVEL);
}

/** 세션 객체 대신 필요한 공개 연구 필드만 받는 최대치 계산 경계다. */
export function staminaMaxForPlayer(player: { playerResearch: { level: number } }): number {
  return staminaMaxForResearchLevel(player.playerResearch.level);
}

export interface StaminaSettlement { amount: number; updatedAt: string; recovered: number; }

/** 서버 시각까지 끝난 5분 구간만 회복하고 남은 구간은 기준 시각에 보존한다. */
export function settleStamina(amount: number, maximum: number, updatedAt: string, serverNow: Date): StaminaSettlement {
  const nowMs = serverNow.getTime();
  const parsed = Date.parse(updatedAt);
  const startMs = Number.isFinite(parsed) && parsed <= nowMs ? parsed : nowMs;
  const safeMaximum = Math.max(0, Math.floor(maximum));
  const safeAmount = Math.min(safeMaximum, Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0)));
  if (safeAmount >= safeMaximum) return { amount: safeAmount, updatedAt: serverNow.toISOString(), recovered: 0 };
  const intervals = Math.floor((nowMs - startMs) / STAMINA_REGEN_INTERVAL_MS);
  const recovered = Math.min(safeMaximum - safeAmount, intervals);
  const nextUpdatedMs = safeAmount + recovered >= safeMaximum ? nowMs : startMs + recovered * STAMINA_REGEN_INTERVAL_MS;
  return { amount: safeAmount + recovered, updatedAt: new Date(nextUpdatedMs).toISOString(), recovered };
}

/** 서버 DTO의 다음 회복 및 완충 시각을 동일한 기준점에서 계산한다. */
export function staminaTiming(amount: number, maximum: number, updatedAt: string): { nextRecoveryAt: string | null; fullAt: string | null } {
  if (amount >= maximum) return { nextRecoveryAt: null, fullAt: null };
  const next = Date.parse(updatedAt) + STAMINA_REGEN_INTERVAL_MS;
  return { nextRecoveryAt: new Date(next).toISOString(), fullAt: new Date(next + Math.max(0, maximum - amount - 1) * STAMINA_REGEN_INTERVAL_MS).toISOString() };
}
