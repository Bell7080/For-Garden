import type { Stats } from "./types";

/**
 * 전투력 — 한 개체가 지금 얼마나 센지를 나타내는 한 숫자.
 *
 * 능력치는 열두 개라 두 개체를 나란히 놓아도 어느 쪽이 센지 바로 읽히지 않는다. 그래서
 * "지금 얼마나 컸는가"를 묻는 자리(정보창·정렬)만 이 한 숫자로 답한다. 전투 계산에는 절대
 * 쓰지 않는다 — 실제 전투는 능력치를 그대로 쓰고, 이 값은 표시와 정렬 전용이다.
 *
 * 가중치는 "한 점이 전투에서 얼마나 값어치를 하는가"에 맞춘다. 체력은 수가 크므로 낮게,
 * 공격·주문은 피해로 곧장 이어지므로 높게, 치명타 확률처럼 백분율로 오르는 값은 한 점의
 * 무게가 크므로 더 높게 둔다. 표가 한 곳뿐이라 화면마다 다른 전투력이 나오지 않는다.
 */
const WEIGHTS: Readonly<Record<keyof Stats, number>> = {
  hp: 0.5,
  def: 2.4,
  res: 2.4,
  atk: 3.4,
  ap: 3.4,
  attackSpeed: 3,
  moveSpeed: 1.2,
  critChance: 4,
  critDamage: 1.6,
  energyGain: 2,
  lifeSteal: 3,
  ferocityGain: 2,
};

/** 표시용 전투력. 정수로 떨어뜨려 같은 능력치가 늘 같은 수로 보이게 한다. */
export function combatPower(stats: Stats): number {
  return Math.round((Object.keys(WEIGHTS) as (keyof Stats)[]).reduce((sum, key) => sum + stats[key] * WEIGHTS[key], 0));
}
