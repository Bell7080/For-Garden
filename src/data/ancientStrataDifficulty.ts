/** 고대 지층 전용 예산. 스토리/레이드/캐릭터 원본에는 적용하지 않는다. */
export const ANCIENT_STRATA_MAX_FLOOR = 200;
export const ANCIENT_STRATA_TIME_LIMIT_SECONDS = 90;
export const ANCIENT_STRATA_ENEMY_LEVEL = 20;

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
  { first: 1, last: 20, focus: "entry", hpStep: 1.019, attackStep: 1.019, defenseStep: 1.006 },
  { first: 21, last: 40, focus: "sustain", hpStep: 1.026, attackStep: 1.0165, defenseStep: 1.006 },
  { first: 41, last: 60, focus: "armor", hpStep: 1.019, attackStep: 1.019, defenseStep: 1.0105 },
  { first: 61, last: 80, focus: "offense", hpStep: 1.019, attackStep: 1.026, defenseStep: 1.006 },
  { first: 81, last: 100, focus: "mixed", hpStep: 1.026, attackStep: 1.024, defenseStep: 1.009 },
  { first: 101, last: 120, focus: "ranker", hpStep: 1.065, attackStep: 1.055, defenseStep: 1.022 },
  { first: 121, last: 150, focus: "future", hpStep: 1.085, attackStep: 1.075, defenseStep: 1.03 },
  { first: 151, last: 200, focus: "future", hpStep: 1.10, attackStep: 1.09, defenseStep: 1.035 },
];

/** 초중반 지원 적은 자기 예산의 15%에서 시작해 20층에 걸쳐 자란다. 미래 구간 합류는 전액 적용한다. */
export const ANCIENT_REINFORCEMENTS = [
  { relicId: "toby", startsAt: 21, fullAt: 40, maximumShare: 0.45, initialShare: 0.15 },
  { relicId: "ripa", startsAt: 41, fullAt: 60, maximumShare: 0.45, initialShare: 0.15 },
  // 미래 구간은 큰 한 방만 더 세게 만들지 않는다. 분산 타격·지속 피해로 피격 상한/비례 막 편성을 검수한다.
  // 새 CC는 추가하지 않는다. 태생 단계 보정은 아래 전용 share가 이미 포함한 최종 예산으로 취급한다.
  { relicId: "ikanixia", startsAt: 121, fullAt: 140, maximumShare: 0.45, initialShare: 1 },
  { relicId: "pulsi", startsAt: 141, fullAt: 160, maximumShare: 0.45, initialShare: 1 },
] as const;
