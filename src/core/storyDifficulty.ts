import type { BattleStageDef, StageDef } from "./types";

export const STORY_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type StoryDifficulty = typeof STORY_DIFFICULTIES[number];
/** 쉬움 템플릿의 오각형에만 곱한다. 전환부 전투력은 전 난이도 4-10에 약 10% 차이로 이어지며 최종 관문의 실제 완주 가능성도 검수한다. */
export const STORY_DIFFICULTY = {
  easy: { color: 0xe6bc57, text: "#f5d47b", fill: 0x3a3016, reward: 1, statFactor: 1 },
  normal: { color: 0xec9144, text: "#ffb76e", fill: 0x412719, reward: 1.25, statFactor: 2 },
  hard: { color: 0xe66168, text: "#ff9297", fill: 0x401f2a, reward: 1.5, statFactor: 4 },
} as const;
/**
 * **장 배율 — 장마다 오각형 다섯에 한 번 더 곱한다**(응태 결정, v0.391.0). 레벨 사다리가 60에서 멈춰
 * 4장 이후 적 하나의 전투력이 거의 평평했고(3장 3,400 → 7장 4,600), 그사이 플레이어는 룬·유대로 계속 자라
 * 5-10을 무손실로 넘겼다. 1장 1.0 · 2장 1.05 · 3장 1.1 · 4장 1.15 · 5장 1.2 · 6장 1.25 · 7장 1.3 · 8장 1.35(v0.391.11 응태 결정 — 장마다 0.05씩 고르게, 얕게).
 * 장마다 하나이고 관문별 예외는 두지 않는다. 난이도 배율(`statFactor`)과 곱하며 공속·이속·치명타·스킬은 바꾸지 않는다.
 * 체감하며 조정하는 값이라 이 표 하나만 고친다.
 */
export const STORY_CHAPTER_STAT_FACTOR: Readonly<Record<number, number>> = { 2: 1.05, 3: 1.1, 4: 1.15, 5: 1.2, 6: 1.25, 7: 1.3, 8: 1.35 };
/**
 * **쉬움만 4장부터 장 배율을 덜 받는다**(응태 결정, 2026-11-12 — 「보통에서 확 어려워질 테니 쉬움은 밀 만해야 한다. 특히 6장부터 힘들다」).
 * 균등 레벨 검수에서 6장 후반·7장이 적 레벨보다 10~30레벨 높은 파티를 요구했다(5장은 적 레벨보다 낮은 파티로 열렸다).
 * 보통·어려움은 위 표를 그대로 쓰므로 쉬움을 낮춰도 보통의 세기는 바뀌지 않는다 — 쉬움과 보통 사이의 계단만 넓어진다.
 * 관문별 예외는 두지 않고 장마다 하나다.
 */
export const STORY_EASY_CHAPTER_STAT_FACTOR: Readonly<Record<number, number>> = { 2: 1.05, 3: 1.1, 4: 1.1, 5: 1.1, 6: 1.0, 7: 0.95, 8: 0.95 };
export function storyChapterStatFactor(chapter: number | undefined, difficulty: StoryDifficulty): number {
  const table = difficulty === "easy" ? STORY_EASY_CHAPTER_STAT_FACTOR : STORY_CHAPTER_STAT_FACTOR;
  return table[chapter ?? 0] ?? 1;
}
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
