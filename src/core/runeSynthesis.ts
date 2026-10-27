import type { RunePart, RuneInstance, RuneRarity } from "./runes";
import { RUNE_TRAIT_GRADES, type RuneTrait, type RuneTraitGrade } from "./runeTraits";

/**
 * 고고학 「룬 합성」의 규칙.
 *
 * 각인까지 마친 같은 등급 룬 셋을 골드로 녹여 새 룬 하나를 만든다. **골드가 쌓여 쓸 곳이 없는
 * 계정의 소모처**라 값은 등급마다 크게 오른다. 결과 등급은 같은 등급이거나 한 단계 위이고
 * 내려가지 않으며, 특성은 넣은 룬의 특성이 좋을수록 좋은 쪽으로 기운다.
 *
 * 확률·값은 이 표에만 있다 — 서버 판정과 확률 쪽지가 같은 값을 읽는다.
 */

const RARITY_ORDER: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];

/** 한 번에 넣는 룬 수. 삼각형의 꼭짓점 셋이다. */
export const RUNE_SYNTHESIS_INPUTS = 3;

export const RUNE_SYNTHESIS_RULES = {
  /** 합성 한 번의 골드(응태 결정 — 골드 과잉 해소). */
  goldCost: { uncommon: 200_000, rare: 400_000, epic: 600_000, legendary: 1_000_000 },
  /** 한 등급 위가 나올 확률(%). 2026-10-25 응태 확정으로 35/25/12 → 50/40/25 상향. 전설은 위가 없어 새 전설로 옵션·특성만 다시 굴린다. */
  upgradePercent: { uncommon: 50, rare: 40, epic: 25, legendary: 0 },
  /**
   * 결과 특성 확률(%) — 넣은 룬 중 **가장 높은 특성 등급**이 줄을 고른다. 칸 순서는 없음 → 고급 → 희귀 → 영웅 → 전설.
   */
  traitPercent: {
    none: [55, 30, 12, 3, 0],
    uncommon: [25, 45, 22, 7, 1],
    rare: [15, 25, 35, 20, 5],
    epic: [10, 15, 25, 38, 12],
    legendary: [5, 10, 20, 35, 30],
  },
  /** 특성 달린 룬이 하나 더 있을 때마다 「없음」에서 떼어 최고 등급 칸에 얹는 몫(%). */
  extraTraitShiftPercent: 15,
} as const satisfies {
  goldCost: Readonly<Record<RuneRarity, number>>;
  upgradePercent: Readonly<Record<RuneRarity, number>>;
  traitPercent: Readonly<Record<RuneTraitGrade | "none", readonly [number, number, number, number, number]>>;
  extraTraitShiftPercent: number;
};

export type RuneSynthesisRefusal = "count" | "duplicate" | "notEngraved" | "rarityMismatch" | "locked";

/** 이 룬을 합성 재료로 쓸 수 있는가 — 각인까지 마쳤고 잠기지 않았다. 끼고 있는 룬도 쓸 수 있고, 합성하면 장착이 풀린다. */
export function isRuneSynthesisMaterial(rune: RuneInstance): boolean {
  return rune.engravings.length > 0 && rune.locked !== true;
}

/** 재료 셋이 합성 조건을 지키는지. 지키면 `null`, 아니면 첫 거절 사유다. 서버와 화면이 같은 판정을 쓴다. */
export function runeSynthesisRefusal(runes: readonly RuneInstance[]): RuneSynthesisRefusal | null {
  if (runes.length !== RUNE_SYNTHESIS_INPUTS) return "count";
  if (new Set(runes.map(({ instanceId }) => instanceId)).size !== runes.length) return "duplicate";
  if (runes.some((rune) => rune.engravings.length === 0)) return "notEngraved";
  if (runes.some(({ rarity }) => rarity !== runes[0].rarity)) return "rarityMismatch";
  if (runes.some(({ locked }) => locked === true)) return "locked";
  return null;
}

/** 결과 등급 확률 — `[같은 등급, 한 등급 위]`(%). */
export function runeSynthesisRarityOdds(rarity: RuneRarity): { same: number; up: number; next: RuneRarity | undefined } {
  const up = RUNE_SYNTHESIS_RULES.upgradePercent[rarity];
  return { same: 100 - up, up, next: RARITY_ORDER[RARITY_ORDER.indexOf(rarity) + 1] };
}

export function rollRuneSynthesisRarity(rarity: RuneRarity, random: number): RuneRarity {
  assertRandom(random);
  const odds = runeSynthesisRarityOdds(rarity);
  return odds.next !== undefined && random * 100 < odds.up ? odds.next : rarity;
}

/** 넣은 룬들의 특성으로 결과 특성 확률(%) 다섯 칸을 만든다. 칸 순서는 없음 → 고급 → … → 전설. */
export function runeSynthesisTraitOdds(traits: readonly (RuneTrait | undefined)[]): readonly number[] {
  const present = traits.filter((trait): trait is RuneTrait => trait !== undefined);
  if (present.length === 0) return [...RUNE_SYNTHESIS_RULES.traitPercent.none];
  const best = present.reduce((top, trait) => RUNE_TRAIT_GRADES.indexOf(trait.grade) > RUNE_TRAIT_GRADES.indexOf(top) ? trait.grade : top, present[0].grade);
  const odds = [...RUNE_SYNTHESIS_RULES.traitPercent[best]];
  const shift = Math.min(odds[0], (present.length - 1) * RUNE_SYNTHESIS_RULES.extraTraitShiftPercent);
  odds[0] -= shift;
  odds[RUNE_TRAIT_GRADES.indexOf(best) + 1] += shift;
  return odds;
}

/** 결과 특성 등급을 굴린다. `undefined`면 특성 없음. */
export function rollRuneSynthesisTraitGrade(traits: readonly (RuneTrait | undefined)[], random: number): RuneTraitGrade | undefined {
  assertRandom(random);
  const odds = runeSynthesisTraitOdds(traits);
  let cursor = random * 100;
  for (let index = 0; index < odds.length; index += 1) {
    cursor -= odds[index];
    if (cursor < 0) return index === 0 ? undefined : RUNE_TRAIT_GRADES[index - 1];
  }
  // 부동소수 끝자락은 마지막으로 0이 아닌 칸에 붙인다.
  let last = odds.length - 1;
  while (last > 0 && odds[last] <= 0) last -= 1;
  return last === 0 ? undefined : RUNE_TRAIT_GRADES[last - 1];
}

/** 결과 룬의 자리 — 셋이 같은 자리면 그 자리, 섞여 있으면 넣은 셋 중 하나. */
export function rollRuneSynthesisPart(parts: readonly RunePart[], random: number): RunePart {
  assertRandom(random);
  if (parts.length === 0) throw new RangeError("자리를 고를 재료가 없습니다.");
  return parts[Math.min(parts.length - 1, Math.floor(random * parts.length))];
}

function assertRandom(random: number): void {
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError("합성 난수는 0 이상 1 미만이어야 합니다.");
}

/**
 * 원석으로 사는 「랜덤 룬」의 등급 확률(%). 등급·자리·옵션이 모두 무작위이고 특성은 없다.
 */
export const RANDOM_RUNE_RARITY_PERCENT: Readonly<Record<RuneRarity, number>> = { uncommon: 50, rare: 35, epic: 13, legendary: 2 };

export function rollRandomRuneRarity(random: number): RuneRarity {
  assertRandom(random);
  let cursor = random * 100;
  for (const rarity of RARITY_ORDER) {
    cursor -= RANDOM_RUNE_RARITY_PERCENT[rarity];
    if (cursor < 0) return rarity;
  }
  return "legendary";
}
