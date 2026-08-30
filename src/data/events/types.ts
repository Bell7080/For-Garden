import type { DialogueStory } from "../../core/dialogue";
import type { BattleStageDef } from "../../core/types";

/** 이벤트 임무는 정적 목표만 설명하며 진행 계산은 API 구현이 소유한다. */
export interface EventMissionDefinition {
  id: string;
  title: string;
  objective: { type: "clear_stage" | "complete_story"; targetId: string; count: 1 };
  rewardProductId?: string;
}

/** 기존 콘텐츠 정의를 묶는 운영 단위다. 대사·전투·상품 규칙 자체는 복제하지 않는다. */
export interface EventDefinition {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  story: DialogueStory;
  /** 완료 시 기존 completedStoryIds에 기록되어 회상에서 그대로 찾는 스토리 ID다. */
  recollectionStoryId: string;
  /** 운영 이벤트는 현재 전투만 지원하므로 스토리 지도 노드를 받지 않는다. */
  stages: readonly BattleStageDef[];
  missions: readonly EventMissionDefinition[];
  /** 실제 가격·지급·구매 제한은 공용 PRODUCTS 카탈로그가 소유한다. */
  exchangeProductIds: readonly string[];
}
