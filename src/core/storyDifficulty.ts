import type { BattleStageDef, StageDef } from "./types";

export const STORY_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type StoryDifficulty = typeof STORY_DIFFICULTIES[number];
/** 쉬움 템플릿의 오각형에만 곱한다 — 보통 ×1.5 · 어려움 ×2(응태 결정 2026-11-12, ×2·×4는 과했다). 다음 난이도 1-1은 이전 난이도 4-10보다 튀어 오르지 않는다. */
export const STORY_DIFFICULTY = {
  easy: { color: 0xe6bc57, text: "#f5d47b", fill: 0x3a3016, reward: 1, statFactor: 1 },
  normal: { color: 0xec9144, text: "#ffb76e", fill: 0x412719, reward: 1.25, statFactor: 1.5 },
  hard: { color: 0xe66168, text: "#ff9297", fill: 0x401f2a, reward: 1.5, statFactor: 2 },
} as const;
/*
 * 장 배율(`STORY_CHAPTER_STAT_FACTOR`)은 걷어 냈다(응태 결정 2026-11-12 — 「레벨제로 갔으니 이제 필요 없다」).
 * 레벨이 60에서 멈추던 때 4장 이후를 조이려 둔 축이었는데, 적 레벨에 상한이 없어진 뒤로는 세기를 레벨 하나가 말한다.
 * 스토리 적 세기는 레벨 사다리 · 유형 배수 · 난이도 `statFactor`뿐이다.
 */
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
export function isStoryStageAvailable(stage: StageDef, cleared: ReadonlySet<string>): boolean {
  return isStoryDifficultyUnlocked(storyDifficultyOf(stage.id), cleared) && stage.prerequisiteStageIds.every(id => cleared.has(id));
}
/** Only normal currencies grow; fossil/rune drops keep their established role and quantity. */
export function difficultyStageRewards(rewards: BattleStageDef["rewards"], difficulty: StoryDifficulty): BattleStageDef["rewards"] {
  const multiplier = STORY_DIFFICULTY[difficulty].reward;
  return { firstClearCheesecake: Math.round(rewards.firstClearCheesecake * multiplier), repeatClearCheesecake: Math.round(rewards.repeatClearCheesecake * multiplier),
    firstClearBonus: rewards.firstClearBonus?.map(reward => reward.kind === "currency" && reward.currency !== "fossil" ? { ...reward, amount: reward.currency === "gems" ? Math.round(reward.amount * multiplier / 10) * 10 : reward.currency === "gold" ? Math.round(reward.amount * multiplier / 100) * 100 : Math.round(reward.amount * multiplier) } : { ...reward }) };
}
