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

/** 누적 태그는 겹을 올리는 시점에도 긴 대기를 적용해 발동을 미리 비축하지 못한다. */
export function expeditionControlCooldown(payload: { kind: string; status?: CombatStatusEffect }): number | undefined {
  if (payload.kind === "frozen") return 8;
  if (payload.kind !== "status" || !payload.status || !EXPEDITION_CONTROL_TAGS.has(payload.status.kind)) return undefined;
  const kind = payload.status.kind;
  if (kind === "stagger") return payload.status.kind === "stagger" && payload.status.seconds <= 0.15 ? 1 : 2;
  if (kind === "chill") return 4;
  if (kind === "stun") return payload.status.kind === "stun" && payload.status.seconds <= 0.25 ? 4 : 6;
  if (kind === "fear") return 6;
  return kind === "pressure" || kind === "drowsy" || kind === "intimidate" ? 10 : 8;
}
