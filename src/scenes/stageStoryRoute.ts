import { storyDifficultyOf } from "../core/storyDifficulty";
import type Phaser from "phaser";
import { pendingPostStory, pendingPreStory } from "../data/stageStories";
import { session } from "../state/session";
import { startScene } from "../ui/screenTransition";

/** 이야기가 끝난 뒤 이어 갈 씬. 이야기가 겹치면 `data` 안에 다음 이야기가 중첩된다. */
export interface SceneRoute {
  scene: string;
  data?: Record<string, unknown>;
}

/** 이야기 하나를 연 뒤 `then`으로 이어 가는 길. */
function storyRoute(storyId: string, then: SceneRoute): SceneRoute {
  return { scene: "stageStory", data: { storyId, then } };
}

/** 이 관문의 편성 화면으로 가는 길. 초회 전 대사가 남았으면 그것을 먼저 거친다. */
export function partyRoute(stageId: string): SceneRoute {
  const pre = storyDifficultyOf(stageId) === "easy" ? pendingPreStory(stageId, session.completedStoryIds) : undefined;
  const party: SceneRoute = { scene: "party" };
  return pre ? storyRoute(pre, party) : party;
}

/** 이긴 뒤 `then`으로 가기 전에 초회 후 대사를 거치는 길. */
export function victoryRoute(stageId: string, then: SceneRoute): SceneRoute {
  const post = storyDifficultyOf(stageId) === "easy" ? pendingPostStory(stageId, session.completedStoryIds) : undefined;
  return post ? storyRoute(post, then) : then;
}

export function goRoute(scene: Phaser.Scene, route: SceneRoute): void {
  startScene(scene, route.scene, route.data);
}
