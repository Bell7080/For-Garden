import { describe, expect, it } from "vitest";
import { BOND_STORY_LEVELS, DIARY_QUESTION_COUNT } from "../../src/core/relicStory";
import { DialogueFlow } from "../../src/core/dialogue";
import { RELIC_STORIES } from "../../src/data/relicStories";
import { getRelic } from "../../src/data/relics";
import { BOND_LEVEL_CAP } from "../../src/core/bond";

/** 이야기 묶음이 갖춰진 개체는 모양을 전부 채워야 한다 — 하나씩 다져 가므로 개체마다 같은 틀을 지킨다. */
describe.each(Object.entries(RELIC_STORIES))("%s 이야기 묶음", (relicId, story) => {
  it("은 관찰 질문 셋과 선택지를 갖고, 아이디가 겹치지 않는다", () => {
    expect(story.questions).toHaveLength(DIARY_QUESTION_COUNT);
    const ids = story.questions.flatMap((q) => [q.id, ...q.choices.map((c) => `${q.id}/${c.id}`)]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of story.questions) {
      expect(q.prompt.trim()).not.toBe("");
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of q.choices) for (const text of [c.label, c.reply, c.note]) expect(text.trim(), `${q.id}/${c.id}`).not.toBe("");
    }
  });

  it("은 애착 스토리가 유대 4·6·8·10에 하나씩 있고 끝까지 읽히며, 본인이 한 번은 나선다", () => {
    expect(Object.keys(story.bondStories).map(Number)).toEqual([...BOND_STORY_LEVELS]);
    for (const level of BOND_STORY_LEVELS) {
      const chapter = story.bondStories[level];
      expect(chapter.id).toBe(`bond.${relicId}.${level}`);
      expect(() => new DialogueFlow(chapter)).not.toThrow();
      expect(chapter.titleCard).toBeDefined();
      expect(chapter.nodes.some((node) => node.speaker === getRelic(relicId).name), String(level)).toBe(true);
    }
  });

  it("은 유대 0~10마다 대사를 여럿 갖는다", () => {
    expect(story.bondLines).toHaveLength(BOND_LEVEL_CAP + 1);
    for (const lines of story.bondLines) {
      expect(lines.length).toBeGreaterThanOrEqual(3);
      for (const line of lines) expect(line.trim()).not.toBe("");
    }
  });

  it("은 발굴 기록과 일기가 도감 정의에 그대로 서 있다", () => {
    const def = getRelic(relicId);
    expect(def.fossilRecord).toBe(story.fossilRecord);
    expect(def.unlockRecord).toMatchObject({ status: "recorded", text: story.diary });
  });
});
