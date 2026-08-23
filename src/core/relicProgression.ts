import type { HeartGemStatEffect } from "../data/heartGems";
import { RUNE_STAT_RULES } from "../data/runes";
import { assertValidRuneInstance, type RuneInstance } from "./runes";
import type { RelicProgress, Stats } from "./types";

/** 돌파를 하지 않은 렐릭의 레벨 상한. 프로토타입에서도 최대 상태를 금방 볼 수 있게 짧다. */
export const RELIC_LEVEL_CAP = 20;

/**
 * 돌파 단계별로 열리는 레벨 상한과 재료.
 *
 * 급여만으로는 천장을 넘지 못한다. 돌파는 "재료를 모아 한 번 더 크게 열어 주는" 행동이라
 * 레벨과는 다른 재화(DNA 조각)를 쓴다. 표가 하나뿐이므로 화면과 서버가 같은 조건을 본다.
 */
export interface BreakthroughStep {
  /** 이 단계를 열었을 때의 레벨 상한. */
  levelCap: number;
  dnaFragments: number;
  cheesecake: number;
}

export const BREAKTHROUGH_STEPS: readonly BreakthroughStep[] = [
  { levelCap: 30, dnaFragments: 2, cheesecake: 200 },
  { levelCap: 40, dnaFragments: 4, cheesecake: 500 },
  { levelCap: 50, dnaFragments: 8, cheesecake: 1000 },
];

/** 돌파를 몇 번까지 할 수 있는지. */
export const BREAKTHROUGH_CAP = BREAKTHROUGH_STEPS.length;

/** 지금 돌파 단계에서의 레벨 상한. 상한을 묻는 곳은 전부 이 함수를 쓴다. */
export function relicLevelCap(breakthrough: number): number {
  if (!Number.isInteger(breakthrough) || breakthrough < 0 || breakthrough > BREAKTHROUGH_CAP) {
    throw new RangeError("돌파 단계가 범위를 벗어났습니다.");
  }
  return breakthrough === 0 ? RELIC_LEVEL_CAP : BREAKTHROUGH_STEPS[breakthrough - 1].levelCap;
}

/** 다음 돌파에 드는 재료. 이미 끝까지 뚫었으면 없다. */
export function nextBreakthrough(breakthrough: number): BreakthroughStep | undefined {
  return BREAKTHROUGH_STEPS[breakthrough];
}

/**
 * 돌파할 수 있는지.
 *
 * 레벨을 상한까지 채운 뒤에만 뚫을 수 있다. 그래야 돌파가 "더 키우고 싶을 때 하는 선택"이
 * 되고, 재료를 미리 태워 두는 낭비가 생기지 않는다.
 */
export function canBreakThrough(progress: RelicProgress, wallet: { dnaFragments: number; cheesecake: number }): boolean {
  const step = nextBreakthrough(progress.breakthrough);
  if (!step) return false;
  if (progress.level < relicLevelCap(progress.breakthrough)) return false;
  return wallet.dnaFragments >= step.dnaFragments && wallet.cheesecake >= step.cheesecake;
}
/** 각성 상한. 같은 렐릭을 다섯 번 더 만나면 끝이다. */
export const AWAKENING_CAP = 5;
/** 급여 한 번에 드는 치즈케이크와 그때 오르는 경험치. */
export const FEED_UNIT = { cheesecake: 10, exp: 20 } as const;

/**
 * 레벨 N에서 N+1로 가는 데 필요한 경험치.
 *
 * 한 번 먹였다고 곧바로 오르지 않는다. 경험치는 급여 말고도 여러 곳에서 조금씩 차오를 값이라,
 * 레벨 하나가 여러 번의 행동을 담을 만큼은 커야 한다. 낮은 레벨은 세 번, 뒤로 갈수록 더 든다.
 */
export function relicExpToNext(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > relicLevelCap(BREAKTHROUGH_CAP)) throw new RangeError("레벨이 성장 범위를 벗어났습니다.");
  return 40 + level * 20;
}

/**
 * 각성 단계별 해금 효과.
 *
 * 같은 렐릭을 다시 만날 때마다 하나씩 열린다. 셋째·넷째 단계만 능력치를 올리고 나머지는
 * 전투 방식 자체를 바꾼다 — 단계마다 성격이 달라야 다음 중복이 기대된다.
 */
export interface AwakeningStep {
  step: number;
  label: string;
  /** 모든 능력치에 더해지는 백분율. 없으면 0이다. */
  statPercent?: number;
  /** 일반 공격 피해 배율 증가(0.25 = +25%). */
  basicDamage?: number;
  /** 궁극기 피해 배율 증가. */
  ultimateDamage?: number;
  /** 전투 시작 시 궁극기가 준비된 상태로 시작하는지. */
  readyUltimate?: boolean;
}

export const AWAKENING_STEPS: readonly AwakeningStep[] = [
  { step: 1, label: "일반 공격 피해 +25%", basicDamage: 0.25 },
  { step: 2, label: "궁극기 피해 +25%", ultimateDamage: 0.25 },
  { step: 3, label: "모든 능력치 +15%", statPercent: 15 },
  { step: 4, label: "모든 능력치 +15%", statPercent: 15 },
  { step: 5, label: "전투 시작 시 궁극기 준비", readyUltimate: true },
];

/** 해당 단계까지 열린 효과를 한 값으로 합친다. 전투와 UI가 같은 표를 본다. */
export function awakeningBonus(awakening: number): { statPercent: number; basicDamage: number; ultimateDamage: number; readyUltimate: boolean } {
  const opened = AWAKENING_STEPS.filter((entry) => entry.step <= awakening);
  return {
    statPercent: opened.reduce((sum, entry) => sum + (entry.statPercent ?? 0), 0),
    basicDamage: opened.reduce((sum, entry) => sum + (entry.basicDamage ?? 0), 0),
    ultimateDamage: opened.reduce((sum, entry) => sum + (entry.ultimateDamage ?? 0), 0),
    readyUltimate: opened.some((entry) => entry.readyUltimate === true),
  };
}

export interface RelicFeedResult {
  progress: RelicProgress;
  cheesecake: number;
  /** 실제로 소비한 급여 횟수. 치즈케이크나 레벨 상한에 걸리면 요청보다 적을 수 있다. */
  feeds: number;
  levelsGained: number;
}

/**
 * 급여로 경험치를 올린다.
 *
 * 한 번에 여러 번 먹이는 버튼이 있으므로 반복 처리도 순수 함수 하나로 끝낸다. 상한에 닿으면
 * 남은 경험치는 버리지 않고 그 자리에서 멈춘다 — 치즈케이크만 사라지고 아무 일도 없는 급여를
 * 만들지 않기 위해서다.
 */
export function feedRelic(progress: RelicProgress, cheesecake: number, feeds: number): RelicFeedResult {
  if (!Number.isInteger(feeds) || feeds < 1) throw new RangeError("급여 횟수는 1 이상의 정수여야 합니다.");
  if (!Number.isInteger(cheesecake) || cheesecake < 0) throw new RangeError("치즈케이크가 올바르지 않습니다.");
  const cap = relicLevelCap(progress.breakthrough);
  let level = progress.level;
  let exp = progress.exp;
  let spent = 0;
  let used = 0;
  for (let i = 0; i < feeds; i += 1) {
    if (level >= cap) break;
    if (cheesecake - spent < FEED_UNIT.cheesecake) break;
    spent += FEED_UNIT.cheesecake;
    used += 1;
    exp += FEED_UNIT.exp;
    while (level < cap && exp >= relicExpToNext(level)) {
      exp -= relicExpToNext(level);
      level += 1;
    }
    // 상한에 닿으면 경험치는 더 쌓지 않는다.
    if (level >= cap) exp = 0;
  }
  return {
    progress: { ...progress, level, exp, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] },
    cheesecake: cheesecake - spent,
    feeds: used,
    levelsGained: level - progress.level,
  };
}

/** 급여를 한 번이라도 할 수 있는지. 버튼을 끌지 말지 판단하는 단일 기준이다. */
export function canFeedRelic(progress: RelicProgress, cheesecake: number): boolean {
  return progress.level < relicLevelCap(progress.breakthrough) && Number.isInteger(cheesecake) && cheesecake >= FEED_UNIT.cheesecake;
}
/** 레벨 N에서 N+1로 갈 때 드는 치즈케이크다. 선형 비용은 각 레벨 투자의 의미를 쉽게 조정하게 한다. */
export function relicLevelUpCost(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > RELIC_LEVEL_CAP) throw new RangeError("레벨이 성장 범위를 벗어났습니다.");
  return level * 10;
}

/** UI와 API가 같은 경계 판정을 쓰도록 현재 성장 상태를 값으로 반환한다. */
export function canLevelUpRelic(progress: RelicProgress, cheesecake: number): boolean {
  return progress.level < RELIC_LEVEL_CAP && Number.isInteger(cheesecake) && cheesecake >= relicLevelUpCost(progress.level);
}

export interface RelicLevelUpResult {
  progress: RelicProgress;
  cheesecake: number;
  cost: number;
}

/** 원본을 변경하지 않고 비용 차감과 새 성장 상태를 함께 계산해 서버가 원자적으로 커밋하게 한다. */
export function levelUpRelic(progress: RelicProgress, cheesecake: number): RelicLevelUpResult {
  const cost = relicLevelUpCost(progress.level);
  if (progress.level >= RELIC_LEVEL_CAP) throw new RangeError("이미 최대 레벨입니다.");
  if (!Number.isInteger(cheesecake) || cheesecake < cost) throw new RangeError("치즈케이크가 부족합니다.");
  return { progress: { ...progress, level: progress.level + 1, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] }, cheesecake: cheesecake - cost, cost };
}

/** 모든 능력치를 빠짐없이 같은 규칙으로 순회하기 위한 고정 키 목록이다. */
const STAT_KEYS: readonly (keyof Stats)[] = ["hp", "def", "res", "atk", "ap", "attackSpeed", "moveSpeed", "critChance", "critDamage", "energyGain", "lifeSteal", "ferocityGain"];

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

/** 각성이 능력치를 올리는 것은 3·4단계뿐이다. 나머지 단계는 전투 규칙을 바꾼다. */
export function applyAwakening(stats: Stats, awakening: number): Stats {
  if (!Number.isInteger(awakening) || awakening < 0 || awakening > AWAKENING_CAP) throw new RangeError("각성 단계는 0~5의 정수여야 합니다.");
  const percent = awakeningBonus(awakening).statPercent;
  return applyStatPercent(stats, Object.fromEntries(STAT_KEYS.map((key) => [key, percent])) as HeartGemStatEffect);
}

/** 장착된 Heart Gem을 슬롯 순서대로 적용해 저장 순서까지 계산 규칙의 일부로 고정한다. */
export function applyHeartGems(stats: Stats, gems: readonly RuneInstance[]): Stats {
  const result = { ...stats };
  for (const gem of gems) {
    assertValidRuneInstance(gem);
    for (const option of [...gem.mainStats, ...gem.subStats]) {
      const rule = RUNE_STAT_RULES[option.key];
      // 저장된 option.value는 과거 버전의 중복 합산값일 수 있어, 성공 이력과 표로 정규화한다.
      const successes = (gem.enhancementHistory[option.key] ?? []).filter(({ succeeded }) => succeeded).length;
      const engraved = gem.engravings.some(({ statKey }) => statKey === option.key) ? 1 : 0;
      const value = rule.base + rule.enhancement * (successes + engraved);
      const key = option.key as keyof Stats;
      result[key] = rule.unit === "percentagePoint"
        ? result[key] + value
        : Math.round(result[key] * (1 + value / 100));
    }
  }
  return result;
}

/** 최종 능력치는 기본 → 레벨 → DNA → Heart Gem 순서로만 계산한다. */
export function calculateFinalStats(base: Stats, progress: RelicProgress, gems: readonly RuneInstance[]): Stats {
  if (progress.heartGemSlots.length !== 3) throw new RangeError("Heart Gem 슬롯은 정확히 3개여야 합니다.");
  return applyHeartGems(applyAwakening(applyLevelGrowth(base, progress.level), progress.awakening), gems);
}
