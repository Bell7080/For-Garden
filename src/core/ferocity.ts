import type { Combatant } from "./combatTypes";
import type { RelicDef } from "./types";

/** 실시간 난전과 전투 UI가 함께 쓰는 야성 경계와 증가량이다. */
export const FEROCITY_RULES = {
  min: 0,
  /** 개체가 `ferocityMax`를 적지 않았을 때의 아군 기본 최대치다. */
  max: 100,
  /** 적 전용 개체의 기본 최대치 — 아군보다 조금 더 높게 둬 폭주가 늦게 온다. */
  enemyMax: 130,
  basicGain: 12,
  ultimateGain: 18,
  hitGain: 8,
  /** 최대치가 얼마든 가득 찬 피버가 이 시간(초) 만에 모두 소진된다. 높은 개체는 더 빨리 닳는다. */
  feverSeconds: 8,
  /** 구간은 최대치에 대한 비율이다 — 최대치가 달라도 같은 진행도에서 같은 보너스가 붙는다. */
  thresholds: [
    { ratio: 0.5, damageBonus: 0.1 },
    { ratio: 0.8, damageBonus: 0.2 },
    { ratio: 1, damageBonus: 0.35 },
  ],
} as const;

/** 그 개체의 야성 최대치. 정의가 적은 값이 우선이고, 없으면 아군 100 · 적 130이다. */
export function ferocityMaxOf(def: Pick<RelicDef, "ferocityMax" | "enemyOnly">): number {
  return def.ferocityMax ?? (def.enemyOnly ? FEROCITY_RULES.enemyMax : FEROCITY_RULES.max);
}

/** 최대치에서 시작한 피버가 `feverSeconds`에 다 닳도록 정한 초당 감소량이다. */
export function feverDrainPerSecond(def: Pick<RelicDef, "ferocityMax" | "enemyOnly">): number {
  return ferocityMaxOf(def) / FEROCITY_RULES.feverSeconds;
}

/** 한 몸의 야성을 같은 진행도로 다른 몸(소환수)에 옮긴다. 최대치가 다른 몸끼리도 비율은 같다. */
export function ferocityMirrored(from: Combatant, to: Combatant): number {
  return (from.ferocity / ferocityMaxOf(from.def)) * ferocityMaxOf(to.def);
}

/** 현재 야성 구간에서 공격자에게 주는 누적 피해 보너스를 반환한다. */
export function ferocityDamageBonus(ferocity: number, max: number = FEROCITY_RULES.max): number {
  const active = [...FEROCITY_RULES.thresholds].reverse().find(({ ratio }) => ferocity >= ratio * max);
  return active?.damageBonus ?? 0;
}

/** 최대 야성으로 시작한 피버를 프레임 시간만큼 자연 감소시킨다. */
export function drainFerocityFever(unit: Combatant, seconds: number): void {
  if (!unit.ferocityFever || seconds <= 0) return;
  unit.ferocity = Math.max(FEROCITY_RULES.min, unit.ferocity - feverDrainPerSecond(unit.def) * seconds);
  if (unit.ferocity <= FEROCITY_RULES.min) unit.ferocityFever = false;
}
