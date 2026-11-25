/** 서버 입장 확정 시 한 번만 차감하는 콘텐츠별 스테미나 운영표다. */
export const CONTENT_STAMINA_COSTS = { normalStage: 10, ancientFloor: 0, dailyGrowth: 10, normalExpeditionStart: 12 } as const;

/** 전투 관문 한 판의 스테미나. 스토리는 이긴 판에서만 빼고(`charged-on-victory`), 고대 지층은 쓰지 않는다(0). */
export function battleStageStaminaCost(stage: { ancientFloor?: number }): number {
  return stage.ancientFloor !== undefined ? CONTENT_STAMINA_COSTS.ancientFloor : CONTENT_STAMINA_COSTS.normalStage;
}
