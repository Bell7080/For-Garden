import type { BattleStageDef } from "../../core/types";
import { registerDataText } from "../../i18n";
import { GREAT_AUK_REPORT } from "../dialogues/greatAukReport";
import { FIXED_STAGE_ENEMIES } from "../stages";
import type { EventDefinition } from "./types";

/** 본편 관문과 같은 앞뒤 순서(탱커 → 전사 → 지원가)로 세 적을 세운다. */
const EVENT_STAGE_FORMATION = ["amo", "toby", "ripa"] as const satisfies readonly (typeof FIXED_STAGE_ENEMIES)[number][];

/** 공용 StageDef 전투 규칙을 사용하는 소규모 해안 발굴 전투다. */
const GREAT_AUK_SHORE: BattleStageDef = {
  kind: "battle",
  id: "event-great-auk-shore",
  name: "큰바다쇠오리 해안 발굴지",
  // 이벤트도 캐릭터 정의를 덮어쓰지 않고 플레이어와 같은 성장 축만 고정한다.
  // **자리는 본편과 같다** — 탱커가 앞이고 종이 방어가 뒤다. 예전에는 이 줄이 formationSlot을
  // 빠뜨린 채 단언으로 통과해, 세 적이 모두 0번 자리에 겹쳐 선 상태로 전투에 들어갔다.
  enemies: EVENT_STAGE_FORMATION.map((relicId, formationSlot) => ({
    relicId, level: 4, breakthrough: 0, formationSlot: formationSlot as 0 | 1 | 2,
  })),
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

/** 이벤트 이름과 임무 제목을 언어별로 덮어쓸 수 있게 등록한다. */
registerDataText(GREAT_AUK_SHORE, "name", "event.greatAuk.stage.name");
registerDataText(GREAT_AUK_EVENT, "title", "event.greatAuk.title");
for (const mission of GREAT_AUK_EVENT.missions) registerDataText(mission, "title", `event.greatAuk.mission.${mission.id}`);
