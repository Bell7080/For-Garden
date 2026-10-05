/**
 * 유적별 재탐사 대기와 결정(방치 보너스)의 순수 규칙이다.
 *
 * **결정은 마지막으로 판 시각에서만 센다.** 한 번도 판 적 없는 유적은 0단계로 시작한다 — 늦게 열린
 * 유적의 첫 판이 쌓인 방치로 폭증하지 않게 하려는 것이다. 값은 전부 `archaeologySites.ts`가 갖고
 * 여기서는 읽기만 한다.
 */

import type { ArchaeologySiteDefinition } from "../data/archaeologySites";

const HOUR_MS = 60 * 60 * 1000;

/** 그 유적이 다시 열릴 때까지의 시간(ms)이다. */
export function siteCooldownMs(site: Pick<ArchaeologySiteDefinition, "cooldownHours">): number {
  return site.cooldownHours * HOUR_MS;
}

/** 방치 시간으로 정해지는 결정 단계(0이면 맺히지 않았다)다. 손상된 시각은 맺히지 않은 것으로 본다. */
export function strataCrystalStage(site: Pick<ArchaeologySiteDefinition, "crystal">, lastDigAt: string | undefined, now: Date): number {
  if (!site.crystal || lastDigAt === undefined) return 0;
  const last = Date.parse(lastDigAt);
  if (!Number.isFinite(last)) return 0;
  const idle = now.getTime() - last;
  return site.crystal.reduce((stage, step, index) => idle >= step.afterHours * HOUR_MS ? index + 1 : stage, 0);
}

/** 다음 단계가 맺히는 시각이다. 이미 마지막 단계거나 결정이 없는 유적이면 `null`이다. */
export function nextStrataCrystalAt(site: Pick<ArchaeologySiteDefinition, "crystal">, lastDigAt: string | undefined, now: Date): string | null {
  if (!site.crystal || lastDigAt === undefined) return null;
  const last = Date.parse(lastDigAt);
  if (!Number.isFinite(last)) return null;
  const stage = strataCrystalStage(site, lastDigAt, now);
  const next = site.crystal[stage];
  return next === undefined ? null : new Date(last + next.afterHours * HOUR_MS).toISOString();
}

/** 한 판에 적용되는 몫이다. */
export interface StrataRunModifiers {
  /** 지층 기본 굴착 횟수에 더하는 몫이다. */
  digs: number;
  /** 원석 수량 배율이다. */
  stoneYield: number;
  /** 골드 수량 배율이다(제곱근만 받는다). */
  goldYield: number;
}

/** 중립 몫이다. 유적 없이 열린 판·카탈로그에서 사라진 유적의 판이 쓴다. */
export const NEUTRAL_RUN_MODIFIERS: StrataRunModifiers = { digs: 0, stoneYield: 1, goldYield: 1 };

/**
 * 그 유적이 그 결정 단계에서 내는 몫이다.
 *
 * **원석에만 전량, 골드는 제곱근이다.** 치즈케이크·젬·화석·호박석·룬은 수량 배율이 없고 굴착
 * 횟수로만 는다 — 방치가 프리미엄 재화를 부풀리지 않게 하는 선이다.
 */
export function strataRunModifiers(site: Pick<ArchaeologySiteDefinition, "yield" | "crystal"> | undefined, stage: number): StrataRunModifiers {
  if (site === undefined) return NEUTRAL_RUN_MODIFIERS;
  const step = stage > 0 ? site.crystal?.[stage - 1] : undefined;
  const multiplier = site.yield * (step?.yield ?? 1);
  return { digs: step?.digs ?? 0, stoneYield: multiplier, goldYield: Math.sqrt(multiplier) };
}
