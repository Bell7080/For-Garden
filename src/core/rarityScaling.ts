import type { RelicRarity, Stats } from "./types";

/**
 * 등급이 정하는 태생 능력치와 성장.
 *
 * 오각형(`StatRadar`)이 보여 주는 태생 수치는 그 개체의 **종족값**이다. 역할마다 생김새는
 * 자유롭게 다르지만, 같은 등급끼리는 **총량이 비슷한 띠 안**에 있어야 한다 — R이 SSR보다
 * 태생부터 세면 등급이 뽑을 이유를 말해 주지 못한다.
 *
 * 총량은 전투력(`combatPower`)으로 잰다. 전투력은 곧 그 오각형의 넓이라, "넓이가 등급을
 * 따른다"가 그대로 규칙이 된다. 실제 전투는 여전히 능력치를 그대로 쓰고 이 값은 데이터
 * 검수와 표시에만 쓴다.
 */
export const RARITY_STAT_BAND: Readonly<Record<RelicRarity, { readonly min: number; readonly max: number }>> = {
  R: { min: 2080, max: 2200 },
  SR: { min: 2210, max: 2330 },
  SSR: { min: 2340, max: 2460 },
};

/**
 * 레벨 하나가 올리는 모든 능력치 비율(%).
 *
 * 태생 차이만으로는 키울수록 격차가 그대로 머문다. 등급이 높을수록 조금 더 가파르게 자라
 * 20레벨쯤에서 태생 차이가 한 뼘 더 벌어진다. 값을 크게 벌리지 않는 이유는 낮은 등급을
 * 못 쓰는 개체로 만들지 않기 위해서다.
 */
export const RARITY_LEVEL_GROWTH: Readonly<Record<RelicRarity, number>> = {
  R: 1.8,
  SR: 2.0,
  SSR: 2.2,
};

/**
 * 등급과 무관하게 모든 개체가 공유하는 부가 능력치.
 *
 * 치명타·흡혈·충전량을 개체마다 다르게 적어 두면, 오각형에 보이지 않는 곳에서 총량이
 * 갈려 같은 등급끼리도 세기가 어긋난다. **기본은 전원 같은 값**이고, 그 수치가 필요한
 * 개체는 렉시아처럼 **패시브나 폭주로 끌어다 쓴다** — 그래야 "왜 이 개체가 치명타형인가"가
 * 숨은 기본값이 아니라 읽히는 스킬로 설명된다.
 *
 * 공격 속도·이동 속도는 여기 없다. 그 둘은 난전에서 눈에 보이는 움직임이라 개체마다 다르게
 * 섞는 것이 곧 정체성이다.
 */
export const COMMON_SECONDARY_STATS = {
  critChance: 10,
  critDamage: 150,
  energyGain: 26,
  lifeSteal: 0,
  ferocityGain: 0,
} as const satisfies Partial<Stats>;

/** 등급 띠가 서로 겹치지 않고 R → SR → SSR 순서인지. 데이터 검수와 테스트가 함께 쓴다. */
export const RARITY_ORDER: readonly RelicRarity[] = ["R", "SR", "SSR"];

/** 태생 전투력이 그 등급의 띠 안에 있는지. 새 개체를 넣을 때 이 한 줄로 검수한다. */
export function withinRarityBand(power: number, rarity: RelicRarity): boolean {
  const band = RARITY_STAT_BAND[rarity];
  return power >= band.min && power <= band.max;
}
