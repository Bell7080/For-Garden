import type { Stats } from "../core/types";

/**
 * 모든 렐릭이 공유하는 레이더 축 상한이다. 개별 데이터의 최댓값을 즉석에서 쓰지 않아
 * 신규 캐릭터가 추가되어도 기존 캐릭터의 도형 비율이 바뀌거나 비교가 과장되지 않는다.
 */
export const STAT_RADAR_MAX = {
  hp: 2000,
  def: 200,
  res: 200,
  atk: 200,
  ap: 200,
} as const satisfies Pick<Stats, "hp" | "def" | "res" | "atk" | "ap">;

