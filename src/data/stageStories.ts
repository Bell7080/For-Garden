import { CHAPTER_1_STORIES } from "./dialogues/chapter1";
import { CHAPTER_2_STORIES } from "./dialogues/chapter2";
import { CHAPTER_3_STORIES } from "./dialogues/chapter3";

/**
 * 관문에 달린 전(前)·후(後) 대사. **초회에만** 흐른다.
 *
 * 전 대사는 출격을 누른 뒤 편성 화면 앞에서, 후 대사는 이긴 뒤 결과판을 닫고 나서 흐른다. 모든 관문에
 * 대사가 있을 필요는 없다 — 표에 없는 관문은 이어지는 전투처럼 곧장 넘어간다. 대사 원문은
 * `src/data/dialogues`가 갖고, 이 표는 **어느 관문에 어느 이야기가 붙는가**만 적는다.
 * 완료 판정은 `StoryManager`의 `completedStoryIds` 하나다 — 다시 보기는 회고에서 한다.
 */
export interface StageStoryLink {
  pre?: string;
  post?: string;
}

const LINKS: Readonly<Record<string, StageStoryLink>> = {
  "1-2": { post: "stage-1-2-post" },
  "1-4": { pre: "stage-1-4-pre" },
  "1-5": { pre: "stage-1-5-pre", post: "stage-1-5-post" },
  "1-6": { post: "stage-1-6-post" },
  "1-7": { pre: "stage-1-7-pre" },
  "1-8": { pre: "stage-1-8-pre" },
  "1-8-side-battle": { pre: "stage-1-8-side-pre", post: "stage-1-8-side-post" },
  "1-9": { pre: "stage-1-9-pre", post: "stage-1-9-post" },
  "1-10": { pre: "stage-1-10-pre", post: "stage-1-10-post" },
  "2-1": { pre: "stage-2-1-pre" },
  "2-2": { post: "stage-2-2-post" },
  "2-4": { pre: "stage-2-4-pre" },
  "2-5": { pre: "stage-2-5-pre", post: "stage-2-5-post" },
  "2-6": { post: "stage-2-6-post" },
  "2-7": { pre: "stage-2-7-pre", post: "stage-2-7-post" },
  "2-8": { pre: "stage-2-8-pre", post: "stage-2-8-post" },
  "2-9": { post: "stage-2-9-post" },
  "2-10": { pre: "stage-2-10-pre", post: "stage-2-10-post" },
  "3-1": { pre: "stage-3-1-pre" },
  "3-4": { post: "stage-3-4-post" },
  "3-5": { pre: "stage-3-5-pre", post: "stage-3-5-post" },
  "3-6": { post: "stage-3-6-post" },
  "3-8": { post: "stage-3-8-post" },
  "3-9": { post: "stage-3-9-post" },
  "3-10": { pre: "stage-3-10-pre", post: "stage-3-10-post" },
};

export const STAGE_STORY_LINKS: Readonly<Record<string, StageStoryLink>> = LINKS;

/** 회고가 모아 보여 주는 본편 대사 묶음. 관문 순서대로다. */
export const MAIN_STORY_BUNDLES = [...CHAPTER_1_STORIES, ...CHAPTER_2_STORIES, ...CHAPTER_3_STORIES];

/** 아직 보지 않은 전 대사의 ID. 없으면 `undefined`. */
export function pendingPreStory(stageId: string, completed: ReadonlySet<string>): string | undefined {
  const id = LINKS[stageId]?.pre;
  return id && !completed.has(id) ? id : undefined;
}

/** 아직 보지 않은 후 대사의 ID. 없으면 `undefined`. */
export function pendingPostStory(stageId: string, completed: ReadonlySet<string>): string | undefined {
  const id = LINKS[stageId]?.post;
  return id && !completed.has(id) ? id : undefined;
}
