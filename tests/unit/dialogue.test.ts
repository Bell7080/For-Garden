import { describe, expect, it } from "vitest";
import { DialogueFlow, type DialogueStory } from "../../src/core/dialogue";
import { StoryManager } from "../../src/managers/StoryManager";
import { createDefaultSession } from "../../src/state/session";
import { GREENHOUSE_ECHO } from "../../src/data/dialogues/greenhouseEcho";

const STORY: DialogueStory = {
  id: "test-story", startNodeId: "start", nodes: [
    { id: "start", speaker: "A", body: "선택", choices: [{ id: "left", label: "왼쪽", nextId: "last", effect: { type: "bondXp", relicId: "anky", amount: 5 } }, { id: "right", label: "오른쪽", nextId: "other" }] },
    { id: "last", speaker: "A", body: "끝" },
    { id: "other", speaker: "B", body: "다른 끝" },
  ],
};

describe("DialogueFlow", () => {
  it("1-5 서브 스토리 원문을 끝까지 순회할 수 있다", () => {
    const flow = new DialogueFlow(GREENHOUSE_ECHO);
    expect(flow.current.id).toBe("signal");
    flow.markCurrentNodeReady();
    expect(flow.advance().node?.id).toBe("seed"); flow.markCurrentNodeReady();
    expect(flow.advance().node?.id).toBe("promise"); flow.markCurrentNodeReady();
    expect(flow.advance().completed).toBe(true);
  });
  it("선택한 분기로 이동하고 마지막 노드를 완료한다", () => {
    const flow = new DialogueFlow(STORY);
    flow.markCurrentNodeReady();
    const branch = flow.advance("left");
    expect(branch.node?.id).toBe("last");
    expect(branch.effect).toEqual({ type: "bondXp", relicId: "anky", amount: 5 });
    flow.markCurrentNodeReady();
    expect(flow.advance().completed).toBe(true);
  });

  it("render 사이의 빠른 연속 입력을 한 번만 소비한다", () => {
    const flow = new DialogueFlow({ id: "linear", startNodeId: "one", nodes: [{ id: "one", speaker: "A", body: "1", nextId: "two" }, { id: "two", speaker: "A", body: "2", nextId: "three" }, { id: "three", speaker: "A", body: "3" }] });
    flow.markCurrentNodeReady();
    expect(flow.advance().node?.id).toBe("two");
    expect(flow.advance().node?.id).toBe("two");
  });

  it("최초 렌더 잠금 중 advance가 시작 노드를 소비하지 않는다", () => {
    const flow = new DialogueFlow({ id: "initial-lock", startNodeId: "first", nodes: [{ id: "first", speaker: "A", body: "첫 원문", nextId: "second" }, { id: "second", speaker: "B", body: "다음 원문" }] });
    // Puppet 비동기 표시가 완료되기 전의 진입 입력은 UI 상태와 무관하게 흐름 커서를 유지해야 한다.
    expect(flow.advance()).toMatchObject({ node: { id: "first", body: "첫 원문" }, completed: false });
    expect(flow.current.id).toBe("first");
    flow.markCurrentNodeReady();
    expect(flow.advance().node?.id).toBe("second");
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
