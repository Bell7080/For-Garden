import { generateRune, type RuneInstance, type RuneRarity, type RuneStatKey } from "../core/runes";

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

/** 등급표와 주입된 난수만으로 시작 룬을 만든다. 상태를 읽지도 바꾸지도 않는다. */
export function createStarterRunes(random: () => number): RuneInstance[] {
  return STARTER_RUNE_RARITIES.map((rarity, index) => generateRune({
    instanceId: `starter-rune-${index + 1}`,
    baseName: "발굴 룬",
    rarity,
    random,
  }));
}
