import type { HeartGemStatEffect } from "../data/heartGems";
import type { RelicProgress, RelicRarity, Stats } from "./types";

/**
 * **공명 I~V — 돌파 V 이후의 성장 축**(응태 승인 2026-11-09).
 *
 * 돌파를 끝낸 개체의 중복은 예전에는 곧바로 DNA 마일리지가 되었다. 이제는 그 개체의 파편으로 남아 공명을 한 단계씩 올리고,
 * 공명 V까지 드는 파편을 다 갖춘 뒤의 중복만 마일리지가 된다(`resonanceFragmentRoom`).
 *
 * 공명은 **새 효과를 열지 않고 오각형 다섯만 단계마다 3% 올린다**(`RESONANCE_STAT_PERCENT`). 돌파가 이미 그 개체만의 효과를 다
 * 열었으므로 그 위에 또 효과를 얹으면 "끝까지 키운 개체"의 모양이 흐려진다 — 공명은 같은 개체를 계속 만나는 사람에게 숫자로만 답한다.
 * **PvP(결투·아레나)에서는 꺼진다**(`calculateFinalStats`의 `resonance: false`) — 중복을 많이 만난 계정이 대인전을 숫자로 누르지 않게 한다.
 */
export const RESONANCE_CAP = 5;

/** 공명 한 단계가 오각형 다섯에 얹는 몫(%). 단계마다 더한다(곱하지 않는다). */
export const RESONANCE_STAT_PERCENT = 3;

/** 공명 한 단계에 드는 치즈케이크 — 돌파 마지막 단계와 같은 값이다. */
export const RESONANCE_CHEESECAKE = 2_000;

/**
 * 등급별 공명 한 단계 파편 수(I~V 순서). SSR 완돌 뒤의 중복 여덟(1·1·2·3 이후)과 같은 결로 뒤로 갈수록 더 든다.
 */
export const RESONANCE_FRAGMENTS: Readonly<Record<RelicRarity, readonly [number, number, number, number, number]>> = {
  SSR: [1, 1, 2, 2, 3],
  SR: [2, 2, 3, 3, 4],
  R: [4, 4, 6, 6, 8],
};

/** 저장값을 믿지 않고 0~5 정수로 맞춘다. 공명이 없는 예전 저장은 0이다. */
export function resonanceOf(progress: Pick<RelicProgress, "resonance"> | undefined): number {
  const value = progress?.resonance ?? 0;
  return Number.isInteger(value) ? Math.max(0, Math.min(RESONANCE_CAP, value)) : 0;
}

/** 지금 공명에서 다음 단계로 가는 데 드는 그 개체의 파편 수. 공명 V면 0이다. */
export function resonanceFragmentCost(rarity: RelicRarity, resonance: number): number {
  return resonance >= RESONANCE_CAP ? 0 : RESONANCE_FRAGMENTS[rarity][Math.max(0, resonance)];
}

/** 지금 공명에서 V까지 남은 파편 수. */
export function remainingResonanceFragments(rarity: RelicRarity, resonance: number): number {
  return RESONANCE_FRAGMENTS[rarity].slice(Math.max(0, resonance)).reduce((sum, cost) => sum + cost, 0);
}

/**
 * 돌파 V인 개체가 **파편을 몇 장 더 받아 쓸 수 있는가** — 공명 V까지 남은 파편에서 가진 파편을 뺀 값.
 *
 * 연구소 중복·선택권·마일리지 상점의 파편이 이 한 값을 읽는다: 0보다 크면 파편으로 받고, 0이면 쓸 곳이 없어
 * 마일리지로 바뀌거나(뽑기) 값을 받기 전에 거절한다(상점·선택권).
 */
export function resonanceFragmentRoom(rarity: RelicRarity, resonance: number, held: number): number {
  return Math.max(0, remainingResonanceFragments(rarity, resonance) - Math.max(0, held));
}

/** 다음 공명에서 무엇을 몇 개 쓰는가 — 그 개체의 파편을 먼저 쓰고 모자란 몫만 같은 등급의 만능 파편이 채운다. */
export function resonanceFragmentSpend(rarity: RelicRarity, resonance: number, own: number, universal: number): { own: number; universal: number; enough: boolean } {
  const cost = resonanceFragmentCost(rarity, resonance);
  const fromOwn = Math.min(Math.max(0, own), cost);
  const fromUniversal = Math.min(Math.max(0, universal), cost - fromOwn);
  return { own: fromOwn, universal: fromUniversal, enough: cost > 0 && fromOwn + fromUniversal >= cost };
}

/** 공명할 수 있는가 — 돌파를 끝냈고(`breakthroughCap`), 공명이 V 아래이며, 파편·치즈케이크가 있다. */
export function canResonate(rarity: RelicRarity, progress: Pick<RelicProgress, "breakthrough" | "resonance">, breakthroughCap: number, fragments: number, cheesecake: number, universal: number): boolean {
  if (progress.breakthrough < breakthroughCap) return false;
  const resonance = resonanceOf(progress);
  if (resonance >= RESONANCE_CAP) return false;
  return resonanceFragmentSpend(rarity, resonance, fragments, universal).enough && cheesecake >= RESONANCE_CHEESECAKE;
}

const GROWTH_KEYS: readonly (keyof Stats)[] = ["hp", "def", "res", "atk", "ap"];

/** 공명 단계만큼 오각형 다섯을 올린 효과 — 성장 파이프라인(`calculateFinalStats`)이 레벨 다음에 한 번 곱한다. */
export function resonanceStatEffect(resonance: number): HeartGemStatEffect {
  const percent = Math.max(0, Math.min(RESONANCE_CAP, resonance)) * RESONANCE_STAT_PERCENT;
  return Object.fromEntries(GROWTH_KEYS.map((key) => [key, percent])) as HeartGemStatEffect;
}

/**
 * 그 렐릭이 파편을 몇 장 더 받아 쓸 수 있는가 — 서버(연구소 중복·선택권·마일리지 파편)와 화면(선택권 고르기)이 같은 값을 읽는다.
 * 보유하지 않았거나 돌파 중이면 끝이 없고, 돌파 V면 공명 V까지 남은 몫에서 가진 파편을 뺀다.
 */
export function relicFragmentRoom(rarity: RelicRarity, progress: Pick<RelicProgress, "breakthrough" | "resonance"> | undefined, held: number, breakthroughCap: number): number {
  if (!progress || progress.breakthrough < breakthroughCap) return Number.POSITIVE_INFINITY;
  return resonanceFragmentRoom(rarity, resonanceOf(progress), held);
}
