import type { DialogueStory } from "../../core/dialogue";
import { GREAT_AUK_REPORT } from "./greatAukReport";
import { OPENING_TRAIN } from "./openingTrain";
import { GREENHOUSE_ECHO } from "./greenhouseEcho";

/** 회상 화면이 완료 ID로 찾아갈 수 있는 공용 스토리 레지스트리다. */
export const RECOLLECTION_STORIES: readonly DialogueStory[] = [OPENING_TRAIN, GREAT_AUK_REPORT, GREENHOUSE_ECHO];

/** 잘못된 회상 링크를 조기에 발견하도록 ID 조회 실패를 명시한다. */
export function getRecollectionStory(storyId: string): DialogueStory {
  const story = RECOLLECTION_STORIES.find(({ id }) => id === storyId);
  if (!story) throw new Error(`알 수 없는 회상 스토리 id: ${storyId}`);
  return story;
}
