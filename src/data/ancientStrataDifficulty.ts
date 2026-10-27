/** 고대 지층 전용 예산. 스토리/레이드/캐릭터 원본에는 적용하지 않는다. */
export const ANCIENT_STRATA_MODEL_VERSION = 3;
export const ANCIENT_STRATA_MAX_FLOOR = 200;
export const ANCIENT_STRATA_TIME_LIMIT_SECONDS = 90;
export const ANCIENT_STRATA_ENEMY_LEVEL = 20;
/** 심층 추가 HP만 비례 피해 기준에서 제외한다. */
export const ANCIENT_PERCENT_HP_BASIS_CAP_FLOOR = 120;

export interface AncientDifficultyBand {
  first: number;
  last: number;
  focus: "entry" | "sustain" | "armor" | "offense" | "mixed" | "ranker" | "future";
  /** 직전 층 대비 배율. 첫 층에는 적용하지 않는다. 공속·이속·CC 시간은 늘리지 않는다. */
  hpStep: number;
  attackStep: number;
  defenseStep: number;
}

export const ANCIENT_DIFFICULTY_BANDS: readonly AncientDifficultyBand[] = [
  // v3(응태 요청): 1~100층의 층당 상승폭을 1.2배로 키웠다 — 100층 체력×공격이 v2의 약 2배다.
  { first: 1, last: 20, focus: "entry", hpStep: 1.0192, attackStep: 1.018, defenseStep: 1.0072 },
  { first: 21, last: 40, focus: "sustain", hpStep: 1.0264, attackStep: 1.0168, defenseStep: 1.0072 },
  { first: 41, last: 60, focus: "armor", hpStep: 1.0192, attackStep: 1.018, defenseStep: 1.0126 },
  { first: 61, last: 80, focus: "offense", hpStep: 1.0192, attackStep: 1.0264, defenseStep: 1.0072 },
  { first: 81, last: 100, focus: "mixed", hpStep: 1.0264, attackStep: 1.024, defenseStep: 1.0108 },
  { first: 101, last: 120, focus: "ranker", hpStep: 1.065, attackStep: 1.055, defenseStep: 1.022 },
  { first: 121, last: 150, focus: "future", hpStep: 1.085, attackStep: 1.075, defenseStep: 1.03 },
  { first: 151, last: 200, focus: "future", hpStep: 1.10, attackStep: 1.09, defenseStep: 1.035 },
];

/**
 * 층별 최초 승리만 지급한다. 재도전/재클리어의 반복 보상은 없다.
 *
 * **한 층에 한 종류만 준다**(응태 요청 — 젬 일색이던 표를 나눴다). 10층 한 구간을 같은 틀로 되풀이한다:
 * 끝자리 1·4·7 골드, 2·5·8 치즈케이크, 3·6 젬, 9 룬, 0(관문) 젬. 수량과 룬 등급은 **10층마다** 오르고,
 * 100층을 고층의 기점으로 삼아 그 앞뒤로 결이 갈린다(100층까지 희귀 룬, 101층부터 영웅 룬).
 * 수량은 유료 상품과 같은 깔끔한 단위로 끊는다(`paidAmountUnit`). 젬은 200층 전부 6,500(예전 20,000).
 */
export const ANCIENT_REPEAT_CLEAR_GEMS = 0;
/** 구간(10층) 번호 0~19마다의 수량. 인덱스 9가 91~100층이다. */
export const ANCIENT_REWARD_BLOCKS: readonly { gold: number; cheesecake: number; gems: number; gateGems: number; rune: "uncommon" | "rare" | "epic"; runeTrait: boolean }[] = [
  { gold: 5_000, cheesecake: 60, gems: 50, gateGems: 150, rune: "uncommon", runeTrait: false },
  { gold: 5_500, cheesecake: 70, gems: 50, gateGems: 150, rune: "uncommon", runeTrait: false },
  { gold: 6_000, cheesecake: 80, gems: 50, gateGems: 150, rune: "uncommon", runeTrait: true },
  { gold: 6_500, cheesecake: 90, gems: 50, gateGems: 150, rune: "uncommon", runeTrait: true },
  { gold: 7_000, cheesecake: 100, gems: 50, gateGems: 150, rune: "rare", runeTrait: false },
  { gold: 7_500, cheesecake: 100, gems: 50, gateGems: 150, rune: "rare", runeTrait: false },
  { gold: 8_000, cheesecake: 150, gems: 50, gateGems: 150, rune: "rare", runeTrait: false },
  { gold: 8_500, cheesecake: 150, gems: 50, gateGems: 150, rune: "rare", runeTrait: true },
  { gold: 9_000, cheesecake: 150, gems: 50, gateGems: 150, rune: "rare", runeTrait: true },
  { gold: 10_000, cheesecake: 200, gems: 50, gateGems: 150, rune: "rare", runeTrait: true },
  { gold: 10_000, cheesecake: 200, gems: 100, gateGems: 200, rune: "epic", runeTrait: false },
  { gold: 15_000, cheesecake: 250, gems: 100, gateGems: 200, rune: "epic", runeTrait: false },
  { gold: 15_000, cheesecake: 250, gems: 100, gateGems: 200, rune: "epic", runeTrait: false },
  { gold: 20_000, cheesecake: 300, gems: 100, gateGems: 200, rune: "epic", runeTrait: false },
  { gold: 20_000, cheesecake: 300, gems: 100, gateGems: 200, rune: "epic", runeTrait: true },
  { gold: 25_000, cheesecake: 350, gems: 100, gateGems: 200, rune: "epic", runeTrait: true },
  { gold: 25_000, cheesecake: 350, gems: 100, gateGems: 200, rune: "epic", runeTrait: true },
  { gold: 30_000, cheesecake: 400, gems: 100, gateGems: 200, rune: "epic", runeTrait: true },
  { gold: 30_000, cheesecake: 400, gems: 100, gateGems: 200, rune: "epic", runeTrait: true },
  { gold: 35_000, cheesecake: 500, gems: 100, gateGems: 200, rune: "epic", runeTrait: true },
];

export type AncientFirstClearReward =
  | { kind: "currency"; currency: "gold" | "gems" | "cheesecake"; amount: number }
  | { kind: "rune"; rarity: "uncommon" | "rare" | "epic"; part: 0 | 1 | 2; trait?: true };

export function ancientFirstClearReward(floor: number): AncientFirstClearReward {
  const block = ANCIENT_REWARD_BLOCKS[Math.min(ANCIENT_REWARD_BLOCKS.length - 1, Math.floor((floor - 1) / 10))];
  switch (floor % 10) {
    case 0: return { kind: "currency", currency: "gems", amount: block.gateGems };
    case 3: case 6: return { kind: "currency", currency: "gems", amount: block.gems };
    case 2: case 5: case 8: return { kind: "currency", currency: "cheesecake", amount: block.cheesecake };
    case 9: return { kind: "rune", rarity: block.rune, part: (Math.floor(floor / 10) % 3) as 0 | 1 | 2, ...(block.runeTrait ? { trait: true as const } : {}) };
    default: return { kind: "currency", currency: "gold", amount: block.gold };
  }
}

export function ancientStageId(floor: number): string {
  if (!Number.isInteger(floor) || floor < 1 || floor > ANCIENT_STRATA_MAX_FLOOR) throw new RangeError("Invalid ancient floor");
  return `ancient:${floor}`;
}
export function ancientStageFloor(id: string | null | undefined): number | undefined {
  if (typeof id !== "string" || !/^ancient:[1-9]\d{0,2}$/.test(id)) return undefined;
  const floor = Number(id.slice(8));
  return floor <= ANCIENT_STRATA_MAX_FLOOR ? floor : undefined;
}
