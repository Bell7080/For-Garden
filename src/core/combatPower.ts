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

/**
 * 공격 속도가 공격력·주문력과 함께 자라는 배율 — 지금 공격 능력치 합 ÷ 태생 합.
 *
 * 성장은 오각형 다섯만 올리고 공속은 그대로라(`GROWTH_STAT_KEYS`), 공속을 고정 가중으로만 세던 때는 레벨이 오를수록
 * 공속형(암살자)의 몫이 줄고 오각형이 두꺼운 탱커만 가파르게 올라갔다 — 레벨 100에서 R 켄토가 SR 루카보다, SR 토리카가
 * SSR 스피나보다 높게 읽혔다(2026-11-13 검토). 실제 피해는 공격력 × 공속이라 **공속 한 점의 값어치도 공격 능력치가 큰 만큼
 * 커져야** 한다(응태 결정 2026-11-13). 태생이 없으면(1) 예전 값 그대로라 레벨 1·등급 띠는 움직이지 않는다.
 */
export function offenseGrowth(stats: Stats, base?: Stats): number {
  if (!base) return 1;
  const born = base.atk + base.ap;
  return born > 0 ? Math.max(0, (stats.atk + stats.ap) / born) : 1;
}

/**
 * 표시용 전투력. 정수로 떨어뜨려 같은 능력치가 늘 같은 수로 보이게 한다.
 *
 * `base`는 그 개체의 **태생 능력치**(`RelicDef.stats`, 적도 유형 몫을 얹기 전 값)다. 주면 공속이 공격 능력치와 함께 자란다
 * (`offenseGrowth`). 적과 아군이 같은 규칙으로 잰다 — 성장한 개체의 전투력을 셀 때는 늘 넘긴다.
 */
export function combatPower(stats: Stats, base?: Stats): number {
  const speedGrowth = offenseGrowth(stats, base);
  return Math.round((Object.keys(WEIGHTS) as (keyof Stats)[])
    .reduce((sum, key) => sum + stats[key] * WEIGHTS[key] * (key === "attackSpeed" ? speedGrowth : 1), 0));
}

/** 편성이 한 번에 맞서는 자리 수. 아군 전투력 합은 이 수만큼의 개체로 셈한다. */
export const POWER_COMPARISON_SLOTS = 3;

/**
 * 적 한 무리의 표시 전투력 — **아군 편성(셋)과 같은 머릿수로 맞춘 합**이다.
 *
 * 마주 서는 아군 합은 늘 셋의 합인데, 열다섯이 몰려오는 던전(치즈케이크 대작전)의 적 전투력을
 * 열다섯의 합으로 적으면 개체 하나하나는 약해도 숫자만 부풀어 아군 합과 같은 척도로 읽히지
 * 않는다. 셋 이하로 서는 자리(스토리·정예·보스)는 예전처럼 합 그대로이고, 셋보다 많이 서면
 * 개체 평균 × 셋이다. 표시 전용이며 전투에는 쓰지 않는다.
 */
export function groupCombatPower(stats: readonly Stats[], slots: number = POWER_COMPARISON_SLOTS, bases?: readonly Stats[]): number {
  if (stats.length === 0) return 0;
  const total = stats.reduce((sum, entry, index) => sum + combatPower(entry, bases?.[index]), 0);
  return stats.length <= slots ? total : Math.round(total * slots / stats.length);
}
