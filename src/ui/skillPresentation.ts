import type { CombatStatusEffect, Ultimate } from "../core/types";

/** 전투 좌표 수치 대신 플레이어가 전장에서 찾을 수 있는 대상 범위를 말한다. */
export function targetingLabel(targeting?: Ultimate["targeting"]): string | undefined {
  if (targeting === "single") return "적 한 명";
  if (targeting === "nearbyEnemies") return "자신의 주위 모든 적";
  return undefined;
}

/** 상태 효과 계약을 팝업과 테스트가 함께 쓰는 짧은 문구로 바꾼다. */
export function statusEffectLabel(effect?: CombatStatusEffect): string | undefined {
  if (effect?.kind === "stun") return `[[stun|기절]] ${effect.seconds}초`;
  return undefined;
}

/** 지속 회복 수치는 특정 캐릭터를 사전에 하드코딩하지 않고 현재 정의에서 만든다. */
export function recoveryLabel(percent?: number): string | undefined {
  return percent === undefined ? undefined : `매초 최대 체력의 ${percent}% 회복`;
}
