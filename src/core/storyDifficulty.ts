import type { BattleStageDef, StageDef } from "./types";

export const STORY_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type StoryDifficulty = typeof STORY_DIFFICULTIES[number];
export const STORY_DIFFICULTY = {
  easy: { color: 0xe6bc57, text: "#f5d47b", fill: 0x3a3016, reward: 1 },
  normal: { color: 0xec9144, text: "#ffb76e", fill: 0x412719, reward: 1.25 },
  hard: { color: 0xe66168, text: "#ff9297", fill: 0x401f2a, reward: 1.5 },
} as const;
export function storyDifficultyOf(id: string | null | undefined): StoryDifficulty {
  return id?.startsWith("normal:") ? "normal" : id?.startsWith("hard:") ? "hard" : "easy";
}
export function storyBaseStageId(id: string): string { return id.replace(/^(normal|hard):/, ""); }
export function storyStageId(difficulty: StoryDifficulty, base: string): string { return difficulty === "easy" ? base : `${difficulty}:${base}`; }
export function storyDifficultyRequirement(difficulty: StoryDifficulty): string | undefined {
  return difficulty === "easy" ? undefined : storyStageId(difficulty === "normal" ? "easy" : "normal", "4-10");
}
export function isStoryDifficultyUnlocked(difficulty: StoryDifficulty, cleared: ReadonlySet<string>): boolean {
  const required = storyDifficultyRequirement(difficulty);
  return !required || cleared.has(required) && (difficulty !== "hard" || cleared.has("4-10"));
}
export function newlyUnlockedStoryDifficulty(stageId: string, firstClear: boolean): StoryDifficulty | undefined {
  if (!firstClear) return;
  return stageId === "4-10" ? "normal" : stageId === "normal:4-10" ? "hard" : undefined;
}
/** Normal 1-10 shares Easy 4-10's reference level. Hard 1-10 shares Normal 4-10's endpoint. */
export function storyDifficultyGrowth(difficulty: Exclude<StoryDifficulty, "easy">, chapter: number, order: number): { level: number; multiplier: number } {
  const index = (chapter - 1) * 10 + order - 1;
  return difficulty === "normal"
    ? { level: Math.min(60, 47 + index), multiplier: 1 + Math.max(0, index - 9) / 150 }
    : { level: Math.min(60, 56 + Math.round(index * .5)), multiplier: 1.2 + (index - 9) / 75 };
}
export function isStoryStageAvailable(stage: StageDef, cleared: ReadonlySet<string>): boolean {
  return isStoryDifficultyUnlocked(storyDifficultyOf(stage.id), cleared) && stage.prerequisiteStageIds.every(id => cleared.has(id));
}
/** Only normal currencies grow; fossil/rune drops keep their established role and quantity. */
export function difficultyStageRewards(rewards: BattleStageDef["rewards"], difficulty: StoryDifficulty): BattleStageDef["rewards"] {
  const multiplier = STORY_DIFFICULTY[difficulty].reward;
  return { firstClearCheesecake: Math.round(rewards.firstClearCheesecake * multiplier), repeatClearCheesecake: Math.round(rewards.repeatClearCheesecake * multiplier),
    firstClearBonus: rewards.firstClearBonus?.map(reward => reward.kind === "currency" && reward.currency !== "fossil" ? { ...reward, amount: Math.round(reward.amount * multiplier) } : { ...reward }) };
}
