import type { HeartGemDef, HeartGemStatEffect } from "../data/heartGems";
import type { RelicProgress, Stats } from "./types";

/** 모든 능력치를 빠짐없이 같은 규칙으로 순회하기 위한 고정 키 목록이다. */
const STAT_KEYS: readonly (keyof Stats)[] = ["hp", "def", "res", "atk", "ap", "attackSpeed", "moveSpeed", "critChance", "critDamage", "ferocity"];

/** 한 성장 단계의 백분율을 적용하고 단계마다 반올림해 계산 순서를 결정적으로 만든다. */
export function applyStatPercent(stats: Stats, effect: HeartGemStatEffect): Stats {
  const result = { ...stats };
  for (const key of STAT_KEYS) result[key] = Math.round(stats[key] * (1 + (effect[key] ?? 0) / 100));
  return result;
}

/** 레벨 1은 기본치이며 이후 레벨마다 모든 능력치를 2%씩 높인다. */
export function applyLevelGrowth(base: Stats, level: number): Stats {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("레벨은 1 이상의 정수여야 합니다.");
  const percent = (level - 1) * 2;
  return applyStatPercent(base, Object.fromEntries(STAT_KEYS.map((key) => [key, percent])) as HeartGemStatEffect);
}

/** DNA 숙련도 한 단계마다 모든 능력치를 3% 높이며 0~5 경계를 강제한다. */
export function applyDnaMastery(stats: Stats, dnaMastery: number): Stats {
  if (!Number.isInteger(dnaMastery) || dnaMastery < 0 || dnaMastery > 5) throw new RangeError("DNA 숙련도는 0~5의 정수여야 합니다.");
  return applyStatPercent(stats, Object.fromEntries(STAT_KEYS.map((key) => [key, dnaMastery * 3])) as HeartGemStatEffect);
}

/** 장착된 Heart Gem을 슬롯 순서대로 적용해 저장 순서까지 계산 규칙의 일부로 고정한다. */
export function applyHeartGems(stats: Stats, gems: readonly HeartGemDef[]): Stats {
  return gems.reduce((current, gem) => applyStatPercent(current, gem.statPercent), stats);
}

/** 최종 능력치는 기본 → 레벨 → DNA → Heart Gem 순서로만 계산한다. */
export function calculateFinalStats(base: Stats, progress: RelicProgress, gems: readonly HeartGemDef[]): Stats {
  if (progress.heartGemSlots.length !== 3) throw new RangeError("Heart Gem 슬롯은 정확히 3개여야 합니다.");
  return applyHeartGems(applyDnaMastery(applyLevelGrowth(base, progress.level), progress.dnaMastery), gems);
}
