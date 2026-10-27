import { EXPEDITION_TAG_AUGMENTS } from "./expeditionTagAugments";

/**
 * 피해와 제어를 임의의 '공격력 환산 점수'로 맞추지 않는다. 20초·초당 평타 2/3회·궁극기
 * 3회·직접 피격 12회의 참조 사건으로 발동 횟수와 기계적 상한을 따로 공개한다.
 * 최종 전투 성능은 실제 전투 시뮬레이션으로 검증하며 이 표는 선택 등급의 적정성 보증이 아니다.
 */
export function expeditionTagBalance(id: string, attacksPerSecond = 2 / 3, seconds = 20) {
  const def = EXPEDITION_TAG_AUGMENTS.find(row => row.id === id);
  if (!def || def.effect.kind !== "triggered") return undefined;
  const effect = def.effect;
  const events = (effect.trigger === "onUltimateHit" || effect.trigger === "onUltimateCast") ? Math.floor(seconds / 6)
    : effect.trigger === "onDamaged" ? Math.floor(seconds * 0.6) : Math.floor(seconds * attacksPerSecond);
  const cadence = effect.trigger === "onBasicHit" ? (effect.everyN ?? 1) / attacksPerSecond
    : effect.trigger === "onDamaged" ? (effect.everyN ?? 1) / 0.6 : 6;
  const eligible = Math.floor(events / (effect.everyN ?? 1));
  // 쿨다운 중 문턱을 넘긴 횟수는 저장하지 않으며 다음 N회 문턱에서 다시 판정한다.
  const stride = Math.max(1, Math.ceil(effect.limits.cooldownSeconds / cadence));
  const expectedTriggers = Math.min(effect.limits.maxTriggers, Math.ceil(eligible / stride));
  const status = effect.payload.kind === "status" ? effect.payload.status : undefined;
  return { expectedTriggers, maxTriggers: effect.limits.maxTriggers, cooldownSeconds: effect.limits.cooldownSeconds,
    applications: expectedTriggers * (effect.payload.kind === "shell" || effect.payload.kind === "reagent" ? effect.payload.stacks : effect.applications ?? 1),
    fixedHpPercent: Math.min(10, expectedTriggers * (status?.kind === "concussion" ? status.maxHpPercent
      : status?.kind === "bleed" ? status.seconds * status.maxHpPercentPerSecond
      : effect.payload.kind === "frozen" ? effect.payload.maxHpPercentOnExpire : 0)),
    rawControlSeconds: status && (status.kind === "stagger" || status.kind === "stun" || status.kind === "frenzy" || status.kind === "knockback" || status.kind === "fear")
      ? expectedTriggers * status.seconds : effect.payload.kind === "frozen" ? expectedTriggers * effect.payload.seconds : 0,
  };
}
