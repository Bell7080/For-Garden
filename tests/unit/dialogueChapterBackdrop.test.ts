import { describe, expect, it } from "vitest";
import { CHAPTER_1_STORIES } from "../../src/data/dialogues/chapter1";
import { CHAPTER_2_STORIES } from "../../src/data/dialogues/chapter2";
import { CHAPTER_3_STORIES } from "../../src/data/dialogues/chapter3";
import { CHAPTER_4_STORIES } from "../../src/data/dialogues/chapter4";
import { CHAPTER_5_STORIES } from "../../src/data/dialogues/chapter5";
import { CHAPTER_6_STORIES } from "../../src/data/dialogues/chapter6";
import { CHAPTER_7_STORIES } from "../../src/data/dialogues/chapter7";
import { DIALOGUE_BACKDROP } from "../../src/ui/dialogueStageLayout";
import { BACKGROUND, stageFieldBackground } from "../../src/ui/backgroundAssets";

/** 장 이야기의 무대는 그 장의 전투 전장과 같은 원화여야 한다 — 5장 감금동 이야기가 1장 전장에 서던 것을 막는다. */
describe("장별 대사 무대", () => {
  const chapters = [CHAPTER_1_STORIES, CHAPTER_2_STORIES, CHAPTER_3_STORIES, CHAPTER_4_STORIES, CHAPTER_5_STORIES, CHAPTER_6_STORIES, CHAPTER_7_STORIES];
  chapters.forEach((stories, index) => {
    const chapter = index + 1;
    it(`${chapter}장 이야기는 ${chapter}장 전장 원화 위에 선다`, () => {
      const keys = stories.flatMap((story) => [story.backdrop, ...story.nodes.map((node) => node.backdrop)])
        .filter((key): key is NonNullable<typeof key> => key !== undefined && key !== "train" && key !== "relics");
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(DIALOGUE_BACKDROP[key]).toBe(stageFieldBackground(chapter));
    });
  });
  it("1·2장 무대는 기본 전장이다", () => expect(DIALOGUE_BACKDROP.battlefield).toBe(BACKGROUND.combat));
});
