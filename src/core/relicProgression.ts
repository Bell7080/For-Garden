import type { HeartGemStatEffect } from "../data/heartGems";
import { RUNE_STAT_RULES } from "../data/runes";
import { assertValidRuneInstance, type RuneInstance } from "./runes";
import { RARITY_LEVEL_GROWTH } from "./rarityScaling";
import type { RelicProgress, RelicRarity, Stats } from "./types";

/** 한계 돌파를 하지 않은 렐릭의 레벨 상한. 프로토타입에서도 최대 상태를 금방 볼 수 있게 짧다. */
export const RELIC_LEVEL_CAP = 20;

/**
 * 한계 돌파 = 별.
 *
 * 모든 개체는 별 하나(`I`)로 시작하고, **연구소에서 같은 개체를 다시 획득하면 그 개체의 파편**이 쌓인다.
 * 파편을 모아 한계를 돌파할 때마다 별이 하나 오르고 레벨 상한이 함께 열린다. 별이 다섯(`V`)에
 * 닿은 뒤의 중복은 파편이 아니라 공용 DNA 조각(마일리지)이 된다.
 *
 * 표가 하나뿐이므로 화면과 서버가 같은 조건을 본다. 예전에는 중복이 곧바로 "각성" 수치를
 * 올리고 돌파는 DNA를 쓰는 별개의 축이었지만, 같은 것(중복 획득)을 두 축으로 세면 어느 쪽을
 * 키우는 중인지 읽히지 않아 하나로 합쳤다.
 */
export interface BreakthroughStep {
  /** 이 단계를 열었을 때의 레벨 상한. */
  levelCap: number;
  /** 그 개체의 파편 소모량. 공용 재화가 아니라 **그 캐릭터의 파편**이다. */
  fragments: number;
  cheesecake: number;
  /** 이 별에서 열리는 효과. 화면은 문구를 따로 적지 않는다. */
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

export const BREAKTHROUGH_STEPS: readonly BreakthroughStep[] = [
  { levelCap: 30, fragments: 2, cheesecake: 200, label: "일반 공격 피해 +25%", basicDamage: 0.25 },
  { levelCap: 40, fragments: 4, cheesecake: 500, label: "궁극기 피해 +25%", ultimateDamage: 0.25 },
  { levelCap: 50, fragments: 8, cheesecake: 1000, label: "모든 능력치 +15%", statPercent: 15 },
  { levelCap: 60, fragments: 16, cheesecake: 2000, label: "전투 시작 시 궁극기 준비", readyUltimate: true },
];

/** 한계를 몇 번까지 뚫을 수 있는지. 별 하나에서 시작하므로 최대 별은 이 값 + 1이다. */
export const BREAKTHROUGH_CAP = BREAKTHROUGH_STEPS.length;

/** 화면에 로마자로 서는 별. 돌파 0단계가 별 하나다. */
export const RELIC_STAR_CAP = BREAKTHROUGH_CAP + 1;

/** 돌파 단계를 별 개수로 바꾼다. 별을 세는 곳은 전부 이 함수를 쓴다. */
export function relicStars(breakthrough: number): number {
  if (!Number.isInteger(breakthrough) || breakthrough < 0 || breakthrough > BREAKTHROUGH_CAP) {
    throw new RangeError("돌파 단계가 범위를 벗어났습니다.");
  }
  return breakthrough + 1;
}

/** 지금 돌파 단계에서의 레벨 상한. 상한을 묻는 곳은 전부 이 함수를 쓴다. */
export function relicLevelCap(breakthrough: number): number {
  if (!Number.isInteger(breakthrough) || breakthrough < 0 || breakthrough > BREAKTHROUGH_CAP) {
    throw new RangeError("돌파 단계가 범위를 벗어났습니다.");
  }
  return breakthrough === 0 ? RELIC_LEVEL_CAP : BREAKTHROUGH_STEPS[breakthrough - 1].levelCap;
}

/** 다음 돌파에 드는 재료. 이미 별 다섯이면 없다. */
export function nextBreakthrough(breakthrough: number): BreakthroughStep | undefined {
  return BREAKTHROUGH_STEPS[breakthrough];
}

/**
 * 돌파할 수 있는지.
 *
 * 레벨을 상한까지 채운 뒤에만 뚫을 수 있다. 그래야 돌파가 "더 키우고 싶을 때 하는 선택"이
 * 되고, 파편을 미리 태워 두는 낭비가 생기지 않는다. `fragments`는 **그 개체의** 파편 수다.
 */
export function canBreakThrough(progress: RelicProgress, fragments: number, cheesecake: number): boolean {
  const step = nextBreakthrough(progress.breakthrough);
  if (!step) return false;
  if (progress.level < relicLevelCap(progress.breakthrough)) return false;
  return fragments >= step.fragments && cheesecake >= step.cheesecake;
}

/** 지금까지 열린 별의 효과를 한 값으로 합친다. 전투와 UI가 같은 표를 본다. */
export function breakthroughBonus(breakthrough: number): { statPercent: number; basicDamage: number; ultimateDamage: number; readyUltimate: boolean } {
  const opened = BREAKTHROUGH_STEPS.slice(0, Math.max(0, Math.min(BREAKTHROUGH_CAP, breakthrough)));
  return {
    statPercent: opened.reduce((sum, entry) => sum + (entry.statPercent ?? 0), 0),
    basicDamage: opened.reduce((sum, entry) => sum + (entry.basicDamage ?? 0), 0),
    ultimateDamage: opened.reduce((sum, entry) => sum + (entry.ultimateDamage ?? 0), 0),
    readyUltimate: opened.some((entry) => entry.readyUltimate === true),
  };
}

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

/**
 * 레벨 1은 기본치이며 이후 레벨마다 모든 능력치를 **등급이 정한 비율**로 높인다.
 *
 * 등급을 받는 자리를 선택이 아니라 필수로 둔 이유는, 기본값을 두면 새 호출부가 등급을
 * 빠뜨린 채 모두 같은 속도로 자라기 때문이다. 비율은 `RARITY_LEVEL_GROWTH` 한 표에만 있다.
 */
export function applyLevelGrowth(base: Stats, level: number, rarity: RelicRarity): Stats {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("레벨은 1 이상의 정수여야 합니다.");
  const percent = (level - 1) * RARITY_LEVEL_GROWTH[rarity];
  return applyStatPercent(base, Object.fromEntries(STAT_KEYS.map((key) => [key, percent])) as HeartGemStatEffect);
}

/** 별이 능력치를 직접 올리는 것은 셋째 돌파뿐이다. 나머지 단계는 전투 규칙을 바꾼다. */
export function applyBreakthrough(stats: Stats, breakthrough: number): Stats {
  if (!Number.isInteger(breakthrough) || breakthrough < 0 || breakthrough > BREAKTHROUGH_CAP) throw new RangeError("돌파 단계가 범위를 벗어났습니다.");
  const percent = breakthroughBonus(breakthrough).statPercent;
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

/** 최종 능력치는 기본 → 레벨 → 별 → Heart Gem 순서로만 계산한다. */
export function calculateFinalStats(base: Stats, progress: RelicProgress, gems: readonly RuneInstance[], rarity: RelicRarity): Stats {
  if (progress.heartGemSlots.length !== 3) throw new RangeError("Heart Gem 슬롯은 정확히 3개여야 합니다.");
  return applyHeartGems(applyBreakthrough(applyLevelGrowth(base, progress.level, rarity), progress.breakthrough), gems);
}
