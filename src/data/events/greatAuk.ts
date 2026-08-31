import type { BattleStageDef } from "../../core/types";
import { GREAT_AUK_REPORT } from "../dialogues/greatAukReport";
import { FIXED_STAGE_ENEMIES } from "../stages";
import type { EventDefinition } from "./types";

/** 공용 StageDef 전투 규칙을 사용하는 소규모 해안 발굴 전투다. */
const GREAT_AUK_SHORE: BattleStageDef = {
  kind: "battle",
  id: "event-great-auk-shore",
  name: "큰바다쇠오리 해안 발굴지",
  enemies: [...FIXED_STAGE_ENEMIES],
  enemyLevel: 4,
  rewards: { firstClearCheesecake: 60, repeatClearCheesecake: 15 },
  prerequisiteStageIds: [],
};

/** 한 종의 발굴·기록·교환만 담아 첫 운영 검증 범위를 작게 유지한다. */
export const GREAT_AUK_EVENT: EventDefinition = {
  id: "great-auk-field-report",
  title: "사라진 날개의 발굴 보고서",
  startsAt: "2026-08-20T00:00:00Z",
  endsAt: "2026-09-03T00:00:00Z",
  story: GREAT_AUK_REPORT,
  recollectionStoryId: GREAT_AUK_REPORT.id,
  stages: [GREAT_AUK_SHORE],
  missions: [
    { id: "great-auk-clear-shore", title: "해안 발굴지 확보", objective: { type: "clear_stage", targetId: GREAT_AUK_SHORE.id, count: 1 } },
    { id: "great-auk-file-report", title: "큰바다쇠오리 발굴 보고서 완성", objective: { type: "complete_story", targetId: GREAT_AUK_REPORT.id, count: 1 }, rewardProductId: "event-great-auk-supplies" },
  ],
  exchangeProductIds: ["event-great-auk-supplies"],
};
