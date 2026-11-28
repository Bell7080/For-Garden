import type { Stats } from "../core/types";

/** 레이더의 다섯 축. 화면과 회귀 테스트가 같은 순서를 읽는다. */
export const STAT_RADAR_KEYS = ["hp", "def", "res", "atk", "ap"] as const;
export type StatRadarKey = (typeof STAT_RADAR_KEYS)[number];

/**
 * 모든 렐릭이 공유하는 레이더 축 상한이다. 개별 데이터의 최댓값을 즉석에서 쓰지 않아
 * 신규 캐릭터가 추가되어도 기존 캐릭터의 도형 비율이 바뀌거나 비교가 과장되지 않는다.
 *
 * **체력 축은 아군 탱커의 윗줄(1,800)에 맞춘다**(응태 2026-11-28). 보스 폰토스(2,800)에 맞춘 3,000이던 때는 아군의
 * 체력이 모두 축의 삼분의 일 언저리에 서서, 체력·공격력이 강점인 렉시아(980 · 158)의 면이 조금 높을 뿐인
 * 주문력(92) 쪽으로 쏠려 보였다. 이 선을 넘는 체력(노도니아·데이·보스)은 그 축만 가득 찬다 — 「체력이 가장
 * 두껍다」는 그대로 읽힌다.
 */
export const STAT_RADAR_MAX = {
  hp: 1800,
  def: 200,
  res: 200,
  atk: 200,
  ap: 200,
} as const satisfies Pick<Stats, StatRadarKey>;

/**
 * 다섯 축의 비율(0~1).
 *
 * `base`(태생 능력치)를 주면 **성장 몫을 걷어 내고** 잰다. 레벨·돌파·공명·유대는 다섯 축을 같은 비율로 올리므로,
 * 키운 값을 그대로 상한에 대면 30레벨쯤부터 공격력·주문력이 함께 200에 붙어 — 쓰지도 않는 주문력이 공격력과
 * 같은 크기로 선다 — 면이 그 개체의 생김새를 말하지 못했다. 그래서 지금 값을 「태생 대비 몇 배로 컸나」로 나눠
 * 생김새를 지키고, 얼마나 컸는지는 수치와 전투력이 말한다. 축마다 다르게 오른 몫(룬·유대 각성)은 그대로 남는다.
 *
 * `reference`는 그 성장 배율을 잴 능력치다(기본은 `stats`). 유대가 올린 몫을 붉게 보이는 판은 유대를 뺀 값을 넘겨,
 * 유대 몫이 배율에 묻히지 않고 면 밖으로 넘쳐 보이게 한다.
 */
export function statRadarRatios(stats: Stats, base?: Stats, reference: Stats = stats): Record<StatRadarKey, number> {
  const growth = statRadarGrowth(reference, base);
  return Object.fromEntries(STAT_RADAR_KEYS.map((key) => [key, Math.min(1, Math.max(0, stats[key] / (STAT_RADAR_MAX[key] * growth)))])) as Record<StatRadarKey, number>;
}

/** 태생 대비 성장 배율 — 다섯 축을 상한으로 나눈 합끼리 견준다. 태생이 없거나 더 작으면 1이다. */
export function statRadarGrowth(stats: Stats, base?: Stats): number {
  if (!base) return 1;
  const sum = (value: Stats): number => STAT_RADAR_KEYS.reduce((total, key) => total + Math.max(0, value[key]) / STAT_RADAR_MAX[key], 0);
  const born = sum(base);
  return born > 0 ? Math.max(1, sum(stats) / born) : 1;
}
