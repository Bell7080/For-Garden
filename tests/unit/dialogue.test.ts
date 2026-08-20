import { describe, expect, it } from "vitest";
import { DialogueFlow, type DialogueStory } from "../../src/core/dialogue";
import { StoryManager } from "../../src/managers/StoryManager";
import { createDefaultSession } from "../../src/state/session";

const STORY: DialogueStory = {
  id: "test-story", startNodeId: "start", nodes: [
    { id: "start", speaker: "A", body: "선택", choices: [{ id: "left", label: "왼쪽", nextId: "last", effect: { type: "bondXp", relicId: "anky", amount: 5 } }, { id: "right", label: "오른쪽", nextId: "other" }] },
    { id: "last", speaker: "A", body: "끝" },
    { id: "other", speaker: "B", body: "다른 끝" },
  ],
};

describe("DialogueFlow", () => {
  it("선택한 분기로 이동하고 마지막 노드를 완료한다", () => {
    const flow = new DialogueFlow(STORY);
    const branch = flow.advance("left");
    expect(branch.node?.id).toBe("last");
    expect(branch.effect).toEqual({ type: "bondXp", relicId: "anky", amount: 5 });
    flow.unlockInput();
    expect(flow.advance().completed).toBe(true);
  });

  it("render 사이의 빠른 연속 입력을 한 번만 소비한다", () => {
    const flow = new DialogueFlow({ id: "linear", startNodeId: "one", nodes: [{ id: "one", speaker: "A", body: "1", nextId: "two" }, { id: "two", speaker: "A", body: "2", nextId: "three" }, { id: "three", speaker: "A", body: "3" }] });
    expect(flow.advance().node?.id).toBe("two");
    expect(flow.advance().node?.id).toBe("two");
  });
});

describe("StoryManager", () => {
  it("완료 상태를 저장하고 회상 선택 보상은 지급하지 않는다", () => {
    const state = createDefaultSession();
    const saved: string[][] = [];
    const manager = new StoryManager(state, { save: (next) => saved.push([...next.completedStoryIds]) });
    const before = state.relicProgress.anky.bondXp;
    expect(manager.applyEffect(STORY.id, { type: "bondXp", relicId: "anky", amount: 5 })).toBe(5);
    expect(manager.complete(STORY.id)).toBe(true);
    expect(manager.complete(STORY.id)).toBe(false);
    expect(manager.applyEffect(STORY.id, { type: "bondXp", relicId: "anky", amount: 5 })).toBe(0);
    expect(state.relicProgress.anky.bondXp).toBe(before + 5);
    expect(saved.at(-1)).toEqual([STORY.id]);
  });

  it("검증되지 않은 대상과 과도한 유대 명령을 거부한다", () => {
    const manager = new StoryManager(createDefaultSession(), { save: () => undefined });
    expect(() => manager.applyEffect(STORY.id, { type: "bondXp", relicId: "missing", amount: 5 })).toThrow("대상 렐릭");
    expect(() => manager.applyEffect(STORY.id, { type: "bondXp", relicId: "anky", amount: 999 })).toThrow("0~20");
  });
});
