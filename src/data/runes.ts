import { generateRune, runePartLabel, type RuneInstance, type RunePart, type RuneRarity, type RuneStatKey } from "../core/runes";
import { grantRuneTrait } from "../core/runeTraits";
import { RUNE_TRAIT_IDS } from "./runeTraits";
import { t } from "../i18n";

/** 옵션 수치 단위. percent는 기존 수치에 곱하고 percentagePoint는 게이지/확률에 그대로 더한다. */
export type RuneStatUnit = "percent" | "percentagePoint";

/**
 * 룬 옵션의 생성 기본값·성공 강화 1회 증가량·적용 단위를 소유하는 단일 밸런스 표다.
 * UI, 성장 계산기, 전투가 서로 숫자나 `%`의 의미를 추측하지 않도록 한다.
 */
export const RUNE_STAT_RULES: Readonly<Record<RuneStatKey, { base: number; enhancement: number; unit: RuneStatUnit }>> = {
  hp: { base: 8, enhancement: 2, unit: "percent" },
  atk: { base: 8, enhancement: 2, unit: "percent" },
  ap: { base: 8, enhancement: 2, unit: "percent" },
  def: { base: 8, enhancement: 2, unit: "percent" },
  res: { base: 8, enhancement: 2, unit: "percent" },
  moveSpeed: { base: 5, enhancement: 1, unit: "percent" },
  attackSpeed: { base: 5, enhancement: 1, unit: "percent" },
  lifeSteal: { base: 3, enhancement: 1, unit: "percentagePoint" },
  critChance: { base: 5, enhancement: 1, unit: "percentagePoint" },
  critDamage: { base: 8, enhancement: 2, unit: "percentagePoint" },
  ferocityGain: { base: 5, enhancement: 1, unit: "percent" },
  energyGain: { base: 5, enhancement: 1, unit: "percent" },
};

/** 희귀도와 누적 시도 번호별 골드 비용표다. 운영 수치는 이 표에서만 조정한다. */
export const RUNE_ENHANCEMENT_GOLD_COSTS: Readonly<Record<RuneRarity, readonly number[]>> = {
  uncommon: [100, 150, 200, 250, 300, 350],
  rare: [200, 250, 300, 350, 400, 450, 500, 550, 600],
  epic: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500],
  legendary: [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600],
};

/** 다음 시도의 누적 인덱스로 골드 비용을 조회하며 완료 후 요청은 거부한다. */
export function runeEnhancementGoldCost(rarity: RuneRarity, completedAttempts: number): number {
  if (!Number.isInteger(completedAttempts) || completedAttempts < 0) throw new RangeError("누적 강화 횟수는 0 이상의 정수여야 합니다.");
  const cost = RUNE_ENHANCEMENT_GOLD_COSTS[rarity][completedAttempts];
  if (cost === undefined) throw new RangeError("모든 강화를 마친 룬에는 다음 비용이 없습니다.");
  return cost;
}

/**
 * 시작 룬 열 개의 등급 구성(임시).
 *
 * 세공 화면을 실제로 만져 볼 수 있게 계정에 넣어 주는 임시 지급이다. 등급을 고르게 섞어
 * 보조 옵션 0~3개가 모두 한 번씩 나오도록 했다. 정식 획득 경로(발굴·상점·교환)가 생기면
 * 이 표와 `grantStarterRunes`를 함께 지운다.
 */
export const STARTER_RUNE_RARITIES: readonly RuneRarity[] = [
  "uncommon", "uncommon", "uncommon",
  "rare", "rare", "rare",
  "epic", "epic",
  "legendary", "legendary",
];

/**
 * 시작 룬의 자리 구성(임시).
 *
 * 세 칸을 모두 채워 볼 수 있도록 자리를 고루 섞는다. 한 자리에 몰리면 나머지 두 칸이
 * 비어 있는 채로 장착 규칙을 시험할 수 없다.
 */
export const STARTER_RUNE_PARTS: readonly RunePart[] = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0];

/**
 * 특성이 이미 박힌 채로 오는 시작 룬의 자리(임시).
 *
 * **절반만 특성을 달고 온다.** 실제 플레이에서 주워 오는 룬은 특성이 붙어 있는 것이 섞여
 * 있으므로, 부여 아이템을 쓰지 않고도 곧바로 재해석·등급 상승을 시험할 수 있어야 한다.
 * 나머지 절반은 비워 두어 부여(고대 핵)를 쓰는 길도 함께 열어 둔다. 등급은 고정하지 않고
 * 일반 부여와 **같은 추첨**을 지나므로, 여기서 나온 특성도 실제 부여와 같은 분포를 갖는다.
 */
export const STARTER_RUNE_TRAITED: readonly boolean[] = [true, false, true, false, true, false, true, false, true, false];

/**
 * 이미 받아 둔 시작 룬 중 특성이 비어 있어야 할 자리를 채운다(임시).
 *
 * 특성이 생기기 전에 시작 룬을 받은 저장은 열 개가 모두 특성 없이 남아 있어, 재해석을
 * 시험할 룬이 하나도 없다. 그 자리만 채우고 **이미 붙은 특성은 손대지 않는다** — 굴려 둔
 * 결과를 부트가 조용히 덮으면 천장에 쌓아 둔 실패 횟수까지 사라진다.
 */
export function backfillStarterRuneTraits(runes: readonly RuneInstance[], random: () => number): RuneInstance[] {
  return runes.map((rune) => {
    const index = STARTER_RUNE_TRAITED.findIndex((_, slot) => rune.instanceId === `starter-rune-${slot + 1}`);
    if (index < 0 || !STARTER_RUNE_TRAITED[index] || rune.trait !== undefined) return rune;
    return { ...rune, trait: grantRuneTrait({ traitIds: RUNE_TRAIT_IDS, minimumGrade: "uncommon", random }) };
  });
}

/**
 * 룬 특성을 만져 보기 위한 임시 지급 하한이다.
 *
 * 원석은 재해석 비용(80~260)을 수십 번 치를 만큼, 아이템은 비어 있는 시작 룬 다섯에 부여하고
 * 등급까지 올려 볼 만큼만 둔다. 기본 지갑과 부트의 보충이 **같은 표**를 읽으므로 수치가 두
 * 곳에서 갈리지 않는다. 정식 수급(지층 탐사·상점 교환)이 붙으면 이 표를 함께 지운다.
 */
export const STARTER_RUNE_TRAIT_KIT = {
  rawStone: 50_000,
  items: [
    { itemId: "ancient-core", quantity: 30 },
    { itemId: "refined-core", quantity: 10 },
    { itemId: "restoration-crystal", quantity: 10 },
  ],
} as const satisfies { rawStone: number; items: readonly { itemId: string; quantity: number }[] };

/** 등급표와 주입된 난수만으로 시작 룬을 만든다. 상태를 읽지도 바꾸지도 않는다. */
export function createStarterRunes(random: () => number): RuneInstance[] {
  return STARTER_RUNE_RARITIES.map((rarity, index) => {
    const rune = generateRune({
      instanceId: `starter-rune-${index + 1}`,
      baseName: t("rune.baseName", { part: runePartLabel(STARTER_RUNE_PARTS[index]) }),
      rarity,
      part: STARTER_RUNE_PARTS[index],
      random,
    });
    if (!STARTER_RUNE_TRAITED[index]) return rune;
    return { ...rune, trait: grantRuneTrait({ traitIds: RUNE_TRAIT_IDS, minimumGrade: "uncommon", random }) };
  });
}


/** 서버와 가격 표시가 함께 쓰는 등급·완료 세공 횟수별 룬 판매가의 유일한 원천이다. */
export const RUNE_SELL_VALUES: Readonly<Record<RuneRarity, { base: number; perEnhancement: number }>> = {
  uncommon: { base: 100, perEnhancement: 20 },
  rare: { base: 250, perEnhancement: 40 },
  epic: { base: 600, perEnhancement: 80 },
  legendary: { base: 1500, perEnhancement: 160 },
};

/** 서버가 확정 지급액을 산출하며 UI는 이 함수를 복제하지 않고 응답의 값을 표시한다. */
export function runeSellValue(rune: RuneInstance): number {
  const rule = RUNE_SELL_VALUES[rune.rarity];
  const attempts = Object.values(rune.enhancementHistory).reduce((sum, history) => sum + (history?.length ?? 0), 0);
  return rule.base + attempts * rule.perEnhancement;
}
