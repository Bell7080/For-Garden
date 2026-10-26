/** 고대 지층 전용 예산. 스토리/레이드/캐릭터 원본에는 적용하지 않는다. */
export const ANCIENT_STRATA_MODEL_VERSION = 2;
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
  { first: 1, last: 20, focus: "entry", hpStep: 1.016, attackStep: 1.015, defenseStep: 1.006 },
  { first: 21, last: 40, focus: "sustain", hpStep: 1.022, attackStep: 1.014, defenseStep: 1.006 },
  { first: 41, last: 60, focus: "armor", hpStep: 1.016, attackStep: 1.015, defenseStep: 1.0105 },
  { first: 61, last: 80, focus: "offense", hpStep: 1.016, attackStep: 1.022, defenseStep: 1.006 },
  { first: 81, last: 100, focus: "mixed", hpStep: 1.022, attackStep: 1.020, defenseStep: 1.009 },
  { first: 101, last: 120, focus: "ranker", hpStep: 1.065, attackStep: 1.055, defenseStep: 1.022 },
  { first: 121, last: 150, focus: "future", hpStep: 1.085, attackStep: 1.075, defenseStep: 1.03 },
  { first: 151, last: 200, focus: "future", hpStep: 1.10, attackStep: 1.09, defenseStep: 1.035 },
];

/** 층별 최초 승리만 지급한다. 재도전/재클리어의 반복 보상은 없다. */
export const ANCIENT_FIRST_CLEAR_GEMS = 100;
export const ANCIENT_REPEAT_CLEAR_GEMS = 0;

export function ancientStageId(floor: number): string {
  if (!Number.isInteger(floor) || floor < 1 || floor > ANCIENT_STRATA_MAX_FLOOR) throw new RangeError("Invalid ancient floor");
  return `ancient:${floor}`;
}
export function ancientStageFloor(id: string | null | undefined): number | undefined {
  if (typeof id !== "string" || !/^ancient:[1-9]\d{0,2}$/.test(id)) return undefined;
  const floor = Number(id.slice(8));
  return floor <= ANCIENT_STRATA_MAX_FLOOR ? floor : undefined;
}
