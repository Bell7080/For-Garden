import type { CombatStatusEffect } from "./types";

/** 모든 제공자가 대상 하나의 회복 시계를 공유한다. 원본 스킬의 제어 시간은 변경하지 않는다. */
export const EXPEDITION_CC_POLICY = { maxSeconds: 0.6, recoverySeconds: 2.4 } as const;
export const EXPEDITION_CONTROL_TAGS = new Set<CombatStatusEffect["kind"]>([
  "stun", "stagger", "frenzy", "knockback", "fear", "pressure", "drowsy", "intimidate", "chill", "taunt",
]);
export interface ControlClock {
  stunnedFor: number; staggeredFor: number;
  taunted: { remaining: number } | null;
  frozen: { remaining: number } | null; fear: { remaining: number } | null;
  frenzy: { remaining: number } | null; knockback: { remaining: number } | null;
}
export function controlRemaining(target: ControlClock): number {
  return Math.max(0, target.taunted?.remaining ?? 0, target.stunnedFor, target.staggeredFor, target.frozen?.remaining ?? 0,
    target.fear?.remaining ?? 0, target.frenzy?.remaining ?? 0, target.knockback?.remaining ?? 0);
}
/** 상태 위력 증가를 거친 뒤에도 제어 한 번은 0.6초를 넘지 않는다. 피해·겹 유지 시간은 그대로다. */
export function capExpeditionControl(status: CombatStatusEffect, potency: number): CombatStatusEffect {
  const cap = EXPEDITION_CC_POLICY.maxSeconds;
  const scaledCap = cap / Math.max(1e-6, potency);
  if (status.kind === "stun" || status.kind === "stagger" || status.kind === "frenzy" || status.kind === "taunt") return { ...status, seconds: Math.min(status.seconds, scaledCap) };
  if (status.kind === "fear" || status.kind === "knockback") return { ...status, seconds: Math.min(status.seconds, cap) };
  if (status.kind === "pressure") return { ...status, stunSeconds: Math.min(status.stunSeconds, cap) };
  if (status.kind === "drowsy") return { ...status, sleepSeconds: Math.min(status.sleepSeconds, scaledCap) };
  if (status.kind === "intimidate") return { ...status, fearSeconds: Math.min(status.fearSeconds, cap) };
  return status;
}

/** 쌓여서 터질 때만 행동을 막는 태그. 겹을 올리는 일 자체는 제어가 아니다. */
const STACKING_CONTROL_TAGS = new Set<CombatStatusEffect["kind"]>(["pressure", "drowsy", "intimidate"]);

/** 증강 제어 규칙(한 번 최대 0.6초 · 공유 회복 시계)을 받는 payload인가. */
export function isExpeditionControlPayload(payload: { kind: string; status?: CombatStatusEffect }): boolean {
  return payload.kind === "frozen" || (payload.kind === "status" && payload.status !== undefined && EXPEDITION_CONTROL_TAGS.has(payload.status.kind));
}

/**
 * 곧바로 행동을 막는 태그의 재발동 대기. 누적형(수압·졸음·위압)은 여기서 값을 갖지 않는다 — 겹마다 10초를
 * 걸던 때는 겹이 다음 겹 전에 사라져(유지 12초) 원정 한 판 동안 한 번도 터지지 않았다. 누적형이 미리 비축되지
 * 않는 것은 공유 회복 시계(`augmentControlAvailable` — 회복 중인 적에게는 겹도 오르지 않는다)와 그 상태
 * 자신의 잠금·면역(수압 잠금 · 위압 면역)이 지킨다.
 */
export function expeditionControlCooldown(payload: { kind: string; status?: CombatStatusEffect }): number | undefined {
  if (payload.kind === "frozen") return 8;
  if (payload.kind !== "status" || !payload.status || !EXPEDITION_CONTROL_TAGS.has(payload.status.kind)) return undefined;
  const kind = payload.status.kind;
  if (STACKING_CONTROL_TAGS.has(kind)) return undefined;
  // 경직은 0.1초 고정이라 기본·궁극기판의 길이가 같고 대기도 같다.
  if (kind === "stagger") return 1;
  if (kind === "chill") return 4;
  if (kind === "stun") return payload.status.kind === "stun" && payload.status.seconds <= 0.25 ? 4 : 6;
  if (kind === "fear") return 6;
  return 8;
}
