import { ferocityGainBonus } from "./ferocity";
import type { Role, Stats } from "./types";

/**
 * 전투력 — 한 개체가 지금 얼마나 센지를 나타내는 한 숫자.
 *
 * 능력치는 열두 개라 두 개체를 나란히 놓아도 어느 쪽이 센지 바로 읽히지 않는다. 그래서 "지금 얼마나 센가"를 묻는 자리
 * (정보창·정렬·편성의 두 편 비교·관문 미리보기)만 이 한 숫자로 답한다. 전투 계산에는 절대 쓰지 않는다.
 *
 * **체감 세기에 맞춘 식이다**(응태 결정 2026-11-28 — 「전투력과 체감 강함을 맞추자, 적군과 아군 모두 같은 규칙으로」).
 * 예전에는 능력치마다 가중을 곱해 **더했는데**, 실제 전투는 「얼마나 버티나 × 얼마나 세게 때리나」라 곱으로 오른다 —
 * 레벨이 오를수록 표시가 체감보다 낮게 읽혔고(같은 표시에서 아군 승률 LV10 92% → LV40 54%), 그 틈을 정예·무리·1대1마다
 * 눈대중 배수(×1.6·×2.0·×0.35·×1.8)로 메우고 있었다. 지금은 피해 공식(`computeDamage` — 피해 × 100/(100+방어))에서
 * 나온 두 몫의 기하평균 하나다.
 *
 * - **버티는 몫** E = 체력 × (1 + (방어 + 저항)/200) — 방어·저항이 받는 피해를 줄이는 만큼 실효 체력이 는다.
 * - **때리는 몫** D = max(공격, 주문) × 공속/100 × 치명타 기대 배율.
 * - 전투력 = `POWER_SCALE` × E^0.45 × D^0.55 — 때리는 몫을 조금 더 무겁게 본다(응태 2026-11-28 「전투력은 활약하는 정도」).
 * - **지원가는 때리는 몫을 절반만 센다**(`SUPPORT_OFFENSE_SHARE`) — 지원가의 공격·주문력은 대부분 회복·강화로 나가 피해가
 *   되지 않는다. 직군이 숨은 전투 보정이 아니라 표시 식의 한 항이며, 적과 아군이 같은 규칙을 쓴다.
 *
 * 1만 2천 판 모의(스토리 1~7장 무작위 편성·레벨)에서 승패 예측이 예전 가중합보다 맞았다(log loss 0.492 → 0.403).
 * 남는 오차는 대부분 그 개체의 스킬(기술 몫)이라 숫자 하나로 말하지 않는다. 정예·보스의 체력·공격 몫은 이미 실제
 * 능력치에 들어 있으므로 따로 곱하지 않는다.
 */
export function combatPower(stats: Stats, role: Role): number {
  const endurance = Math.max(0, stats.hp) * (1 + Math.max(0, stats.def + stats.res) / 200);
  const crit = 1 + Math.min(100, Math.max(0, stats.critChance)) / 100 * Math.max(0, stats.critDamage / 100 - 1);
  const share = role === "support" ? SUPPORT_OFFENSE_SHARE : 1;
  const offense = Math.max(0, stats.atk, stats.ap) * Math.max(0, stats.attackSpeed) / 100 * crit * share;
  return Math.round(POWER_SCALE * endurance ** ENDURANCE_EXPONENT * offense ** (1 - ENDURANCE_EXPONENT));
}

/** 버티는 몫의 지수(때리는 몫은 1 − 이 값). 모의에서 맞춘 값이다. */
export const ENDURANCE_EXPONENT = 0.45;

/** 지원가의 때리는 몫 — 공격·주문력의 절반쯤이 회복·강화로 나간다. 모의에서 맞춘 값이다. */
export const SUPPORT_OFFENSE_SHARE = 0.5;

/** 전투력의 눈금 — 1레벨 개체가 예전 표시(2천 남짓)와 비슷한 자릿수로 서게 둔다. 비교에는 영향이 없다. */
export const POWER_SCALE = 5;

/** 편성이 한 번에 맞서는 자리 수. 머릿수 몫(`headcountFactor`)의 기준이다. */
export const POWER_COMPARISON_SLOTS = 3;

/** 머릿수 몫의 지수 — 모의에서 맞춘 값이다(셋보다 적게 서면 무겁게, 많이 서면 가볍게). */
export const HEADCOUNT_EXPONENT = 0.35;

/**
 * **머릿수 몫** — 같은 능력치 합이라도 몇이 나눠 서느냐에 따라 세기가 다르다(혼자 선 하나는 한 번에 하나만 때리지만
 * 셋에게 둘러싸여도 쓰러지기 전까지 제 몫을 다 낸다). 합에 (셋 ÷ 머릿수)^0.35를 곱한다. 직군·자리와 무관하게
 * **적과 아군 모두에** 같은 규칙이다 — 둘만 세운 아군 편성도 같은 몫을 받는다.
 */
export function headcountFactor(count: number): number {
  return count <= 0 ? 0 : (POWER_COMPARISON_SLOTS / count) ** HEADCOUNT_EXPONENT;
}

/** 한 무리(적이든 아군이든)의 표시 전투력 — 개체 전투력의 합 × 머릿수 몫. */
export function groupCombatPower(units: readonly { stats: Stats; role: Role }[]): number {
  return groupPowerOf(units.map((unit) => combatPower(unit.stats, unit.role)));
}

/** 이미 잰 개체 전투력들로 무리 전투력을 낸다(화면이 개체마다 잰 값을 다시 재지 않게). */
export function groupPowerOf(powers: readonly number[]): number {
  if (powers.length === 0) return 0;
  return Math.round(powers.reduce((sum, power) => sum + power, 0) * headcountFactor(powers.length));
}

/**
 * **종족값 총량** — 등급 띠(`RARITY_STAT_BAND`)가 재는 태생 오각형의 넓이. 표시 전투력이 아니다.
 *
 * 직군은 받지 않는다 — 태생 넓이는 직군과 무관하게 같은 띠를 따른다. 전투력이 체감 세기를 재게 되면서(곱셈 식), 역할마다 생김새가 다른 오각형의 「총량」은 따로 재야 한다 — 같은 총량이라도
 * 체력·공격이 한쪽에 몰리면 곱셈 식이 달라진다. 등급 띠의 검수는 예전처럼 능력치마다 가중을 곱해 더한 이 값으로만 한다.
 */
export function statTotal(stats: Stats): number {
  return Math.round((Object.keys(TOTAL_WEIGHTS) as (keyof typeof TOTAL_WEIGHTS)[])
    .reduce((sum, key) => sum + stats[key] * TOTAL_WEIGHTS[key], 0) + ferocityGainBonus(stats) * 2);
}

const TOTAL_WEIGHTS = {
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
} as const satisfies Partial<Record<keyof Stats, number>>;
