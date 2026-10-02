import type { DialogueStory } from "../../core/dialogue";
import { registerDialogueTexts } from "./registerDialogue";
import { GREAT_AUK_REPORT } from "./greatAukReport";
import { OPENING_TRAIN } from "./openingTrain";
import { GREENHOUSE_ECHO } from "./greenhouseEcho";
import { OPENING_RETREAT } from "./openingRetreat";
import { RELIC_STORIES } from "../relicStories";

/** 회상 화면이 완료 ID로 찾아갈 수 있는 공용 스토리 레지스트리다. */
export const RECOLLECTION_STORIES: readonly DialogueStory[] = [OPENING_TRAIN, OPENING_RETREAT, GREAT_AUK_REPORT, GREENHOUSE_ECHO];

/** 렐릭 이야기 묶음의 애착 스토리(`bond.<렐릭>.<유대 레벨>`)도 같은 재생 경로로 연다. */
function bondStoryById(storyId: string): DialogueStory | undefined {
  for (const profile of Object.values(RELIC_STORIES)) {
    for (const story of Object.values(profile.bondStories)) if (story.id === storyId) return story;
  }
  return undefined;
}

/** 잘못된 회상 링크를 조기에 발견하도록 ID 조회 실패를 명시한다. */
export function getRecollectionStory(storyId: string): DialogueStory {
  const story = RECOLLECTION_STORIES.find(({ id }) => id === storyId) ?? bondStoryById(storyId);
  if (!story) throw new Error(`알 수 없는 회상 스토리 id: ${storyId}`);
  return story;
}

for (const story of RECOLLECTION_STORIES) registerDialogueTexts(story);
