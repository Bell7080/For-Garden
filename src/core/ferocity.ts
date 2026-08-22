import type { Combatant } from "./combatTypes";

/** 실시간 난전과 전투 UI가 함께 쓰는 야성 경계와 증가량이다. */
export const FEROCITY_RULES = {
  min: 0,
  max: 100,
  basicGain: 12,
  ultimateGain: 18,
  hitGain: 8,
  /** 최대치에서 시작한 피버가 8초 동안 유지되도록 정한 초당 감소량이다. */
  feverDrainPerSecond: 12.5,
  thresholds: [
    { value: 50, damageBonus: 0.1 },
    { value: 80, damageBonus: 0.2 },
    { value: 100, damageBonus: 0.35 },
  ],
} as const;

/** 현재 야성 구간에서 공격자에게 주는 누적 피해 보너스를 반환한다. */
export function ferocityDamageBonus(ferocity: number): number {
  const active = [...FEROCITY_RULES.thresholds].reverse().find(({ value }) => ferocity >= value);
  return active?.damageBonus ?? 0;
}

/** 최대 야성으로 시작한 피버를 프레임 시간만큼 자연 감소시킨다. */
export function drainFerocityFever(unit: Combatant, seconds: number): void {
  if (!unit.ferocityFever || seconds <= 0) return;
  unit.ferocity = Math.max(FEROCITY_RULES.min, unit.ferocity - FEROCITY_RULES.feverDrainPerSecond * seconds);
  if (unit.ferocity <= FEROCITY_RULES.min) unit.ferocityFever = false;
}
