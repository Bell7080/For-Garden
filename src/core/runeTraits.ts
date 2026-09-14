/**
 * 룬 특성의 순수 도메인 규칙이다.
 *
 * 특성은 기존 룬 옵션·세공·각인을 **바꾸지 않고** 그 위에 한 줄만 얹는다. 룬 하나는 특성이
 * 없거나 하나이며, 특성 등급은 룬 희귀도와 **독립**이다 — 고급 룬에 전설 특성이 붙을 수
 * 있어서 낮은 등급 룬도 보관 가치를 갖는다.
 *
 * Phaser도 저장소도 모르고 난수는 호출자가 주입한다. 상태 확정은 언제나 `GameApi` 경계다.
 */

import type { RuneRarity } from "./runes";

/**
 * 특성 등급.
 *
 * **룬 희귀도와 같은 네 단계를 그대로 쓴다** — 등급 축을 새로 정의하면 같은 「영웅」이
 * 화면에서 두 색으로 보인다. 색도 `RUNE_ACCENT` 한 표를 함께 읽는다.
 */
export type RuneTraitGrade = RuneRarity;

/** 낮은 등급부터의 순서다. 상승·비교가 모두 이 한 배열만 읽는다. */
export const RUNE_TRAIT_GRADES: readonly RuneTraitGrade[] = ["uncommon", "rare", "epic", "legendary"];

/** 룬에 박히는 특성 한 줄이다. 저장에 그대로 직렬화된다. */
export interface RuneTrait {
  /** `RUNE_TRAIT_DEFS`에 실제로 있는 특성 ID다. */
  id: string;
  grade: RuneTraitGrade;
  /**
   * 등급 상승에 연달아 실패한 횟수.
   *
   * 천장이 룬마다 따로 도는 것은 재해석이 **그 룬의 조작**이기 때문이다. 계정 단위로 두면
   * 다른 룬에서 쌓은 실패가 엉뚱한 룬의 등급을 올린다.
   */
  upgradeMisses: number;
}

/** 재해석 한 번의 비용·확률·천장을 소유하는 단일 표다. 화면이 수치를 따로 적지 않는다. */
export const RUNE_TRAIT_RULES = {
  /** 재해석 한 번이 소모하는 원석이다. 높은 등급일수록 비싸다. */
  rerollCost: { uncommon: 80, rare: 120, epic: 180, legendary: 260 },
  /** 재해석에서 등급이 한 단계 오를 확률(0~1)이다. 전설은 오를 곳이 없다. */
  upgradeChance: { uncommon: 0.12, rare: 0.08, epic: 0.05, legendary: 0 },
  /** 이 횟수만큼 연달아 실패하면 다음 재해석에서 **확정으로** 오른다. */
  pityThreshold: { uncommon: 20, rare: 25, epic: 30, legendary: 0 },
} as const satisfies {
  rerollCost: Readonly<Record<RuneTraitGrade, number>>;
  upgradeChance: Readonly<Record<RuneTraitGrade, number>>;
  pityThreshold: Readonly<Record<RuneTraitGrade, number>>;
};

/** 재해석 결과다. 새 특성을 **적용할지는 플레이어가 고르므로** 여기서 룬을 바꾸지 않는다. */
export interface RuneTraitRerollOutcome {
  /** 새로 뽑힌 후보다. 플레이어가 「기존 유지」를 고르면 버려진다. */
  candidate: RuneTrait;
  /** 이번 재해석에서 등급이 올랐는지다. */
  upgraded: boolean;
  /** 천장에 닿아 확정으로 올랐는지다. 화면이 그 한 번을 다르게 알린다. */
  byPity: boolean;
}

/** 한 단계 위 등급을 반환한다. 전설이면 undefined다. */
export function nextRuneTraitGrade(grade: RuneTraitGrade): RuneTraitGrade | undefined {
  return RUNE_TRAIT_GRADES[RUNE_TRAIT_GRADES.indexOf(grade) + 1];
}

/** 등급 확정 상승 아이템을 쓸 수 있는 특성인지 판정한다. 전설에는 쓸 수 없다. */
export function canUpgradeRuneTraitGrade(trait: RuneTrait): boolean {
  return nextRuneTraitGrade(trait.grade) !== undefined;
}

/** 주입된 [0, 1) 난수로 목록에서 하나를 고른다. 범위를 벗어난 난수는 조용히 통과시키지 않는다. */
function pick<T>(pool: readonly T[], random: number): T {
  if (pool.length === 0) throw new RangeError("특성 풀이 비어 있습니다.");
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError("특성 난수는 0 이상 1 미만이어야 합니다.");
  return pool[Math.floor(random * pool.length)];
}

/** 특성 부여·재해석이 공유하는 등급 추첨이다. 최소 등급 아래로는 내려가지 않는다. */
export function rollRuneTraitGrade(minimumGrade: RuneTraitGrade, random: number): RuneTraitGrade {
  const pool = RUNE_TRAIT_GRADES.slice(RUNE_TRAIT_GRADES.indexOf(minimumGrade));
  // 높은 등급일수록 드물게 — 가중치는 순서의 역수라 표를 따로 두지 않고도 단조 감소한다.
  const weights = pool.map((_, index) => 1 / (index + 1) ** 3);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError("특성 난수는 0 이상 1 미만이어야 합니다.");
  let cursor = random * total;
  for (let index = 0; index < pool.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return pool[index];
  }
  return pool[pool.length - 1];
}

/**
 * 특성이 없는 룬에 특성을 부여하거나, 있는 룬에 다시 부여한다.
 *
 * `minimumGrade`는 쓴 아이템이 보장하는 하한이다(일반 부여는 고급, 상위 아이템은 영웅).
 */
export function grantRuneTrait(input: { traitIds: readonly string[]; minimumGrade: RuneTraitGrade; random: () => number }): RuneTrait {
  const grade = rollRuneTraitGrade(input.minimumGrade, input.random());
  return { id: pick(input.traitIds, input.random()), grade, upgradeMisses: 0 };
}

/**
 * 재해석 한 번을 굴린다. **등급은 절대 내려가지 않는다.**
 *
 * 내려갈 수 있으면 좋은 특성을 얻은 사람이 다시 누를 이유가 사라지고, 이 시스템의 반복은
 * 「더 나은 것을 노리는 일」이 아니라 「지키는 일」이 된다.
 */
export function rerollRuneTrait(input: { trait: RuneTrait; traitIds: readonly string[]; random: () => number }): RuneTraitRerollOutcome {
  const { trait } = input;
  const higher = nextRuneTraitGrade(trait.grade);
  const threshold = RUNE_TRAIT_RULES.pityThreshold[trait.grade];
  const byPity = higher !== undefined && threshold > 0 && trait.upgradeMisses + 1 >= threshold;
  const upgraded = higher !== undefined && (byPity || input.random() < RUNE_TRAIT_RULES.upgradeChance[trait.grade]);
  const grade = upgraded && higher !== undefined ? higher : trait.grade;
  return {
    candidate: {
      id: pick(input.traitIds, input.random()),
      grade,
      // 등급이 오르면 천장은 그 등급에서 새로 돈다. 실패만 쌓는다.
      upgradeMisses: upgraded ? 0 : trait.upgradeMisses + 1,
    },
    upgraded,
    byPity,
  };
}

/** 등급 확정 상승 아이템의 결과다. 특성 종류는 그대로 두고 등급만 한 단계 올린다. */
export function upgradeRuneTraitGrade(trait: RuneTrait): RuneTrait {
  const higher = nextRuneTraitGrade(trait.grade);
  if (higher === undefined) throw new Error("전설 특성은 더 올릴 수 없습니다.");
  return { ...trait, grade: higher, upgradeMisses: 0 };
}

/** 저장 불변 조건을 검사하고 위반 시 원인을 담은 오류를 던진다. */
export function assertValidRuneTrait(trait: RuneTrait, knownIds: readonly string[]): void {
  if (!knownIds.includes(trait.id)) throw new Error("알 수 없는 룬 특성 ID입니다.");
  if (!RUNE_TRAIT_GRADES.includes(trait.grade)) throw new RangeError("룬 특성 등급이 올바르지 않습니다.");
  if (!Number.isSafeInteger(trait.upgradeMisses) || trait.upgradeMisses < 0) throw new RangeError("등급 상승 실패 횟수는 0 이상의 정수여야 합니다.");
}
