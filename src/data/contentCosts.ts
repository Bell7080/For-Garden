/** 서버 입장 확정 시 한 번만 차감하는 콘텐츠별 스테미나 운영표다. */
export const CONTENT_STAMINA_COSTS = { normalStage: 10, ancientFloor: 10, dailyGrowth: 10, normalExpeditionStart: 12 } as const;

/** 전투 관문 한 판의 스테미나. 고대 지층도 스토리와 같이 이긴 판에서만 뺀다(`charged-on-victory`). */
export function battleStageStaminaCost(stage: { ancientFloor?: number }): number {
  return stage.ancientFloor !== undefined ? CONTENT_STAMINA_COSTS.ancientFloor : CONTENT_STAMINA_COSTS.normalStage;
}
