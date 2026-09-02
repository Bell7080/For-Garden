import { timeAccrualWindow } from "./timeAccrual";

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
  const safeMaximum = Math.max(0, Math.floor(maximum));
  const safeAmount = Math.min(safeMaximum, Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0)));
  // 최대치까지 필요한 구간만 계산해 수년 단위 오프라인 값도 작은 유한 구간으로 제한한다.
  const accrual = timeAccrualWindow(updatedAt || null, serverNow, Math.max(0, safeMaximum - safeAmount) * STAMINA_REGEN_INTERVAL_MS);
  // 서버 시각 역행/손상은 마지막 정상 틱 기준을 절대로 뒤로 이동시키지 않는다.
  if (!accrual.accepted) return { amount: safeAmount, updatedAt, recovered: 0 };
  const nowIso = new Date(accrual.window.serverNowMs).toISOString();
  if (safeAmount >= safeMaximum || accrual.initialized) return { amount: safeAmount, updatedAt: nowIso, recovered: 0 };
  const intervals = Math.floor(accrual.window.elapsedMs / STAMINA_REGEN_INTERVAL_MS);
  const recovered = Math.min(safeMaximum - safeAmount, intervals);
  const nextUpdatedMs = safeAmount + recovered >= safeMaximum ? accrual.window.serverNowMs : accrual.window.startMs + recovered * STAMINA_REGEN_INTERVAL_MS;
  return { amount: safeAmount + recovered, updatedAt: new Date(nextUpdatedMs).toISOString(), recovered };
}

/** 서버 DTO의 다음 회복 및 완충 시각을 동일한 기준점에서 계산한다. */
export function staminaTiming(amount: number, maximum: number, updatedAt: string): { nextRecoveryAt: string | null; fullAt: string | null } {
  if (amount >= maximum) return { nextRecoveryAt: null, fullAt: null };
  const next = Date.parse(updatedAt) + STAMINA_REGEN_INTERVAL_MS;
  return { nextRecoveryAt: new Date(next).toISOString(), fullAt: new Date(next + Math.max(0, maximum - amount - 1) * STAMINA_REGEN_INTERVAL_MS).toISOString() };
}
