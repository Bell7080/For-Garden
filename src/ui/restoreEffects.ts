/**
 * 회복과 보호막의 연출 세기 — Phaser 없이 값만 정한다(그리는 것은 `EffectManager`).
 *
 * 둘 다 **얼마나 들어왔나**가 곧 무게다. 코어가 사건에 싣는 `intensity`는 받는 쪽 최대 체력의
 * 몇 %였는가(`restoreCueIntensity` — 10%가 1)이고, 여기서 그것을 조각 수·크기·진하기로 옮긴다.
 * 매초 2%씩 도는 재생은 작은 십자 하나가 조용히 떠오르고, 체력 절반을 채우는 회복은 초록 기운이
 * 쏴아 번지며 굵은 십자가 여럿 솟는다. 보호막도 두꺼울수록 선이 굵고 진해져 단단하게 읽힌다.
 *
 * **섬광은 상한(0.6)보다 옅다** — 예쁜 캐릭터를 가리는 순간 이펙트는 방해다.
 */

/** 0(가장 옅음)~1(가장 셈)로 접는다. 세기 3(최대 체력의 30%)이면 가장 센 연출에 닿는다. */
function strength(intensity: number): number {
  return Math.min(1, Math.max(0, (intensity - 0.1) / 2.9));
}

export interface HealVisual {
  /** 솟는 굵은 십자의 수. */
  crosses: number;
  /** 십자 한 변(px). */
  crossSize: number;
  /** 십자가 떠오르는 높이(px). */
  rise: number;
  /** 십자가 몸 둘레로 퍼지는 가로 폭(px). */
  spread: number;
  /** 몸에서 번지는 초록 기운의 크기(px)와 진하기. */
  glowSize: number;
  glowAlpha: number;
  /** 십자 하나가 사는 시간(ms)과 차례로 솟는 간격(ms). */
  lifeMs: number;
  staggerMs: number;
}

export function healVisual(intensity: number): HealVisual {
  const t = strength(intensity);
  return {
    crosses: Math.round(1 + t * 6),
    crossSize: Math.round(26 + t * 26),
    rise: Math.round(46 + t * 84),
    spread: Math.round(24 + t * 66),
    glowSize: Math.round(64 + t * 190),
    glowAlpha: 0.16 + t * 0.36,
    lifeMs: Math.round(620 + t * 280),
    staggerMs: Math.round(70 - t * 40),
  };
}

export interface ShieldAuraStyle {
  /** 테두리 두께(px)와 진하기, 안쪽을 채우는 옅은 막의 진하기. */
  width: number;
  alpha: number;
  fillAlpha: number;
  /** 다시 그릴지 가르는 단계. 매 프레임 그리지 않고 단계가 바뀐 프레임에만 그린다. */
  level: number;
}

/** 두께 단계 수. 잔량이 조금씩 깎일 때마다 다시 그리지 않도록 끊어 둔다. */
export const SHIELD_AURA_LEVELS = 6;

/**
 * 몸을 두른 푸른 막 — **잔량**(최대 체력 대비)이 두께와 진하기를 정한다. 막이 없으면 `null`.
 *
 * 최대 체력의 절반을 넘는 막이면 가장 두껍다. 얇은 막도 한 줄은 또렷해야 두르고 있다는 것이 읽힌다.
 */
export function shieldAuraStyle(shield: number, maxHp: number): ShieldAuraStyle | null {
  if (!(shield > 0) || !(maxHp > 0)) return null;
  const ratio = Math.min(1, shield / maxHp / 0.5);
  const level = Math.max(1, Math.ceil(ratio * SHIELD_AURA_LEVELS));
  const t = level / SHIELD_AURA_LEVELS;
  return { level, width: 2.5 + t * 6.5, alpha: 0.42 + t * 0.46, fillAlpha: 0.04 + t * 0.12 };
}

/** 막이 새로 덮이는 순간의 파문 — 두꺼운 막일수록 굵고 진한 테가 두 겹까지 조여 든다. */
export function shieldGainVisual(intensity: number): { rings: number; width: number; alpha: number; glowAlpha: number } {
  const t = strength(intensity);
  return { rings: t > 0.35 ? 2 : 1, width: 4 + t * 8, alpha: 0.6 + t * 0.35, glowAlpha: 0.12 + t * 0.3 };
}

/** 두른 막의 몸에 대한 비례 — 몸통 가운데를 중심으로 몸을 넉넉히 감싼다. */
export const SHIELD_AURA_SHAPE = { widthRatio: 0.78, heightRatio: 1.08 } as const;
