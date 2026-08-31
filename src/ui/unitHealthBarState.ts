/** Phaser와 무관한 체력 바의 변화 원인. 동기화와 회복은 피격 연출을 만들지 않는다. */
export type HealthChangeCause = "damage" | "heal" | "sync";

/** 실제 HP를 넘기면 호출부마다 비율과 피해량의 기준이 달라지는 일을 막을 수 있다. */
export interface HealthValueInput {
  currentHp: number;
  maxHp: number;
  cause?: HealthChangeCause;
  /** 사건이 이미 HP에 반영된 뒤라면 피해량 또는 직전 HP 중 하나를 함께 넘긴다. */
  damage?: number;
  previousHp?: number;
}

/** 세 값은 서로 다른 시각 정보를 소유하므로 하나의 보간값으로 합치지 않는다. */
export interface UnitHealthBarState {
  /** 지금 초록(또는 진영색)으로 실제 그리는 체력 비율이다. */
  shown: number;
  /** 피해 직전 폭을 잠시 보존하는 붉은 잔상 비율이다. */
  damageTrail: number;
  /** 전투 상태가 요구하는 최종 체력 비율이다. */
  target: number;
  /** 잔상이 멈춰 있는 남은 시간(초)이다. */
  trailHold: number;
  /** 피격 확대·흔들림이 남은 시간(초)이다. */
  reactionLeft: number;
  /** 최대 체력 대비 피해를 단계화한 0~3 피격 강도다. */
  reactionLevel: number;
}

/** 낮은 프레임률에서도 지수 보간 계수가 1을 넘지 않도록 상한을 둔다. */
export const HEALTH_BAR_MOTION = {
  shownEase: 12,
  trailEase: 2.8,
  trailHoldSeconds: 0.18,
  reactionSeconds: 0.24,
} as const;

/**
 * 머리 위 바와 가장자리 프로필이 함께 쓰는 피격 강도 단계다.
 *
 * 두 HUD가 같은 사건을 서로 다른 무게로 말하지 않도록 임계값은 렌더러가 아닌 이 순수 표만
 * 소유한다. 프로필은 안전 영역 때문에 이 단계의 배율만 더 작게 해석한다.
 */
export const HEALTH_DAMAGE_STEPS = [0, 0.08, 0.22] as const;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 최대 체력 대비 피해를 네 단계로 정규화해 절대 공격력과 무관한 타격감을 만든다. */
export function damageReactionLevel(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio < HEALTH_DAMAGE_STEPS[1]) return 1;
  if (ratio < HEALTH_DAMAGE_STEPS[2]) return 2;
  return 3;
}

/** 전투 시작과 재사용 시 세 표시값을 같은 지점에 즉시 맞춘다. */
export function createUnitHealthBarState(ratio = 1): UnitHealthBarState {
  const value = clamp01(ratio);
  return { shown: value, damageTrail: value, target: value, trailHold: 0, reactionLeft: 0, reactionLevel: 0 };
}

/** HP 입력을 비율로 바꾸고, 명시적인 피해 사건에만 잔상과 피격 타이머를 갱신한다. */
export function setUnitHealthValue(state: UnitHealthBarState, input: number | HealthValueInput): UnitHealthBarState {
  if (typeof input === "number") return { ...state, target: clamp01(input) };
  const maxHp = Math.max(1, input.maxHp);
  const target = clamp01(input.currentHp / maxHp);
  const cause = input.cause ?? "sync";
  const damage = input.damage ?? (input.previousHp === undefined ? 0 : Math.max(0, input.previousHp - input.currentHp));
  const level = cause === "damage" ? damageReactionLevel(damage / maxHp) : 0;
  // 사망은 잔상 대기보다 전투 결과 전달이 우선이다. 세 폭과 반응 타이머를 즉시 0으로 닫는다.
  if (target === 0 && cause === "damage") return createUnitHealthBarState(0);
  // 회복에는 붉은 층이 의미가 없으므로 새 체력에 즉시 포갠다. 역방향 잔상도 이 경계에서 막는다.
  if (cause === "heal") return { ...state, target, damageTrail: Math.max(target, state.shown), trailHold: 0 };
  if (level === 0) return { ...state, target };
  return {
    ...state,
    target,
    // 연속 타격은 현재 보이는 가장 큰 폭을 보존하며 절대로 새 체력 왼쪽에서 시작하지 않는다.
    damageTrail: Math.max(state.damageTrail, state.shown, state.target, target),
    trailHold: HEALTH_BAR_MOTION.trailHoldSeconds,
    reactionLeft: HEALTH_BAR_MOTION.reactionSeconds,
    reactionLevel: level,
  };
}

/** 한 프레임을 진행한다. 큰 delta도 보간을 초과시키지 않고 잔상을 현재 체력 이상으로 고정한다. */
export function stepUnitHealthBar(state: UnitHealthBarState, deltaMs: number, motionFactor = 1): UnitHealthBarState {
  const seconds = Math.max(0, deltaMs) / 1000;
  // 끔은 채움을 즉시 맞추되 붉은 피해 잔상의 색과 대기 시간은 남겨 정보 손실을 막는다.
  const shown = motionFactor === 0 ? state.target : state.shown + (state.target - state.shown) * Math.min(1, seconds * HEALTH_BAR_MOTION.shownEase * motionFactor);
  const trailHold = Math.max(0, state.trailHold - seconds);
  let damageTrail = Math.max(state.damageTrail, shown, state.target);
  if (trailHold === 0) {
    damageTrail += (shown - damageTrail) * (motionFactor === 0 ? 1 : Math.min(1, seconds * HEALTH_BAR_MOTION.trailEase * motionFactor));
  }
  // 부동소수점 오차와 저프레임 보간 모두에서 붉은 잔상이 체력 아래로 파고들지 않게 한다.
  damageTrail = Math.max(shown, state.target, damageTrail);
  const reactionLeft = Math.max(0, state.reactionLeft - seconds);
  return { ...state, shown, damageTrail, trailHold, reactionLeft, reactionLevel: reactionLeft > 0 ? state.reactionLevel : 0 };
}
