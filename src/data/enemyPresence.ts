import type { Stats } from "../core/types";

/**
 * 적이 **어떤 무리로 서는가**를 말하는 한 표.
 *
 * 같은 개체라도 혼자 서는 정예와 넷이 몰려오는 무리와 시즌 보스는 화면에서 다른 크기·다른
 * 걸음으로 서야 한다 — 그것이 "지금 무엇을 마주하고 있는가"를 수치가 아니라 **눈**으로
 * 말하는 방법이다. 예전에는 그 몫이 자리마다 흩어져 있었다: 정예의 몸집은 `STAGE_ELITE`가,
 * 레이드 보스의 느린 걸음은 그 **개체의 태생 능력치**가 들고 있었다. 후자가 특히 나쁜데,
 * 수쿠스이노가 도감과 관문에 설 때까지 함께 느려지므로 "레이드에서 크고 느리다"가 아니라
 * "이 개체는 원래 느리다"가 되어 버린다.
 *
 * **이 표가 여는 것은 눈에 보이는 것뿐이다 — 몸집과 걸음.** 체력·방어·저항·공격·주문력은
 * 절대 여기서 움직이지 않는다. 관문의 무게를 조이는 손잡이는 여전히 레벨과 야성 단계
 * 하나뿐이고(`CLAUDE.md`의 "스테이지 전용 배율이나 숨은 보정을 만들지 않는다"), 그 수는
 * 화면이 `LV.30` 옆의 붉은 `+2`로 이미 그린다. 공속·이속을 여기 두는 것은 그 둘이 **화면에서
 * 그대로 보이는 움직임**이기 때문이다 — 숨은 보정이 아니라 눈이 먼저 읽는 성질이다.
 */
export type EnemyPresence = "normal" | "elite" | "swarm" | "raid";

/**
 * 무리로 세는 최소 인원.
 *
 * 셋까지는 관문의 보통 편성이라 그대로 서고, **넷부터** 몰려오는 것으로 본다 — 세 칸짜리
 * 아군 편성보다 많아지는 순간이 "둘러싸였다"가 시작되는 자리다.
 */
export const SWARM_MINIMUM_COUNT = 4;

export const ENEMY_PRESENCE = {
  /** 관문의 보통 적. 기준이라 아무것도 바꾸지 않는다. */
  normal: { bodyScale: 1, attackSpeedPercent: 0, moveSpeedPercent: 0 },
  /**
   * **정예.** 혼자 서는 만큼 몸이 크고, 잘 훈련된 병사처럼 손과 발이 조금 빠르다.
   *
   * 원정 정예 노드의 1.1보다 조금 더 큰 이유는 스토리 전장에는 비교할 다른 적이 하나도 서
   * 있지 않아, 같은 배율로는 "혼자라서 커 보이는 것"과 구별되지 않기 때문이다. 걸음이 한 뼘
   * 빠른 것은 세기가 아니라 **인상**이다 — 같은 수치를 가진 잡졸과 나란히 두었을 때 어느
   * 쪽이 정예인지 서 있는 모습만으로 갈린다.
   */
  elite: { bodyScale: 1.18, attackSpeedPercent: 5, moveSpeedPercent: 5 },
  /**
   * **무리.** 넷 이상이 함께 나올 때만 붙는다.
   *
   * 작게 서는 이유는 둘이다 — 여섯 몸이 보통 크기로 들어차면 전장이 몸으로 덮여 체력 바와
   * 피해 수치가 그 뒤로 숨고, 무엇보다 **하나하나가 가벼워 보여야** 떼로 오는 것이 위협이
   * 된다. 걸음은 건드리지 않는다: 무리의 값은 빠르기가 아니라 머릿수다.
   */
  swarm: { bodyScale: 0.8, attackSpeedPercent: 0, moveSpeedPercent: 0 },
  /**
   * **레이드.** 셋이 하나를 미는 판이라 **거대한 것을 마주한다**가 첫인상이어야 한다.
   *
   * 정예와 같은 크기로 두던 때는 화면이 "레이드"라고 말하는 것이 남은 체력 줄 하나뿐이었다.
   * 느린 것은 그 크기의 짝이다 — 한 방이 무겁고 그 사이가 길어야 다음 턱을 읽고 자리를 옮길
   * 틈이 난다. 이 몫은 **레이드 자리의 성질**이라 개체의 태생 능력치에 적지 않는다.
   */
  raid: { bodyScale: 1.9, attackSpeedPercent: -30, moveSpeedPercent: -42 },
} as const satisfies Record<EnemyPresence, { bodyScale: number; attackSpeedPercent: number; moveSpeedPercent: number }>;

/**
 * 전장에 **동시에 서는 수**와 자리의 성질로 무리 유형을 고른다.
 *
 * 무리를 이루는 것은 등장 총합이 아니라 한 화면에 함께 선 수다 — 셋씩 세 번 나오는 관문은
 * 매 순간 셋이라 둘러싸이지 않는다. 무리로 서는 콘텐츠(대작전)는 가장 큰 무리를 넘긴다.
 */
export function enemyPresenceFor(countOnField: number, options: { elite?: boolean; raid?: boolean } = {}): EnemyPresence {
  if (options.raid === true) return "raid";
  if (options.elite === true) return "elite";
  return countOnField >= SWARM_MINIMUM_COUNT ? "swarm" : "normal";
}

/**
 * 무리 유형이 바꾸는 **걸음만** 얹는다.
 *
 * 나머지 능력치는 손대지 않는다 — 여기서 체력이나 공격력을 움직이면 화면에 선 `LV.n`과
 * 실제로 맞는 수치가 갈리고, 관문을 조이는 손잡이가 둘이 된다.
 */
export function applyEnemyPresence(stats: Stats, presence: EnemyPresence): Stats {
  const { attackSpeedPercent, moveSpeedPercent } = ENEMY_PRESENCE[presence];
  if (attackSpeedPercent === 0 && moveSpeedPercent === 0) return { ...stats };
  return {
    ...stats,
    attackSpeed: Math.round(stats.attackSpeed * (1 + attackSpeedPercent / 100)),
    moveSpeed: Math.round(stats.moveSpeed * (1 + moveSpeedPercent / 100)),
  };
}

/** 그 무리 유형으로 설 때의 몸 크기다. 전투 계산에 들어가지 않고 그리는 크기만 정한다. */
export function enemyPresenceBodyScale(presence: EnemyPresence): number {
  return ENEMY_PRESENCE[presence].bodyScale;
}
