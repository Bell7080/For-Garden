import { GREAT_AUK_EVENT } from "./greatAuk";
import type { EventDefinition } from "./types";

/** 운영 중 추가되는 모든 이벤트의 단일 정적 레지스트리다. */
export const EVENTS: readonly EventDefinition[] = [GREAT_AUK_EVENT];

/** 전투·구매 API가 콘텐츠 소유 이벤트를 역조회할 때 공유한다. */
export function findEventByStageId(stageId: string): EventDefinition | undefined {
  return EVENTS.find(({ stages }) => stages.some(({ id }) => id === stageId));
}

/** 공용 상품 중 이벤트에 귀속된 항목을 API 경계에서 식별한다. */
export function findEventByProductId(productId: string): EventDefinition | undefined {
  return EVENTS.find(({ exchangeProductIds }) => exchangeProductIds.includes(productId));
}

