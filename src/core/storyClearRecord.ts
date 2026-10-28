import type { StageDef } from "./types";
import { highestClearedStage } from "./stageProgress";
import { isStoryDifficultyUnlocked, STORY_DIFFICULTIES, storyBaseStageId, storyDifficultyOf, type StoryDifficulty } from "./storyDifficulty";

/**
 * 난이도 하나의 스토리 클리어 기록 — 프로필의 「최대 스토리」가 펼쳐 보이는 한 줄.
 *
 * `stageId`는 **난이도 접두사를 뗀 기본 관문 ID**(`4-3`)다. 난이도는 `difficulty`가 따로 말하므로 같은 관문을
 * 세 난이도가 같은 이름으로 가리키고, 5~7장이 늘어도 줄 수는 난이도 셋 그대로다. `open`이 거짓이면 아직
 * 열리지 않은 난이도(미개방), 참이면서 `stageId`가 없으면 열렸지만 한 관문도 깨지 않은 것이다.
 */
export interface StoryClearRecord {
  difficulty: StoryDifficulty;
  open: boolean;
  stageId?: string;
}

/** 난이도마다 가장 깊이 깬 본편 관문. `stagesOf`는 그 난이도의 관문 목록이다(쉬움은 전체 스테이지). */
export function storyClearRecords(stagesOf: (difficulty: StoryDifficulty) => readonly StageDef[], cleared: ReadonlySet<string>): StoryClearRecord[] {
  return STORY_DIFFICULTIES.map((difficulty) => {
    const open = isStoryDifficultyUnlocked(difficulty, cleared);
    const highest = open ? highestClearedStage(stagesOf(difficulty), cleared) : undefined;
    return { difficulty, open, ...(highest ? { stageId: storyBaseStageId(highest.id) } : {}) };
  });
}

/** 서버가 보낸 값을 믿지 않고 모양을 다시 거른다 — 모르는 난이도·중복·어긋난 접두사는 버리고 순서는 난이도 표를 따른다. */
export function sanitizeStoryClears(raw: unknown): StoryClearRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const records = STORY_DIFFICULTIES.flatMap((difficulty): StoryClearRecord[] => {
    const found = raw.find((entry): entry is { difficulty: string; open?: unknown; stageId?: unknown } =>
      typeof entry === "object" && entry !== null && (entry as { difficulty?: unknown }).difficulty === difficulty);
    if (!found) return [];
    const stageId = typeof found.stageId === "string" && found.stageId !== "" && storyDifficultyOf(found.stageId) === "easy" ? found.stageId : undefined;
    return [{ difficulty, open: found.open === true, ...(stageId && found.open === true ? { stageId } : {}) }];
  });
  return records.length > 0 ? records : undefined;
}
