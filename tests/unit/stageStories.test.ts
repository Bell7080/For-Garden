import { describe, expect, it } from "vitest";
import { DialogueFlow, dialogueStandingOrder } from "../../src/core/dialogue";
import { getRecollectionStory } from "../../src/data/dialogues/recollections";
import { MAIN_STORY_BUNDLES, STAGE_STORY_LINKS, pendingPostStory, pendingPreStory } from "../../src/data/stageStories";
import { RECOLLECTION_ENTRIES } from "../../src/data/recollectionCatalog";
import { getStage } from "../../src/data/stages";
import { LOBBY_DIALOGUE, lobbyBoundsIntersect } from "../../src/ui/lobbyLayout";
import { LOBBY_MENU_BUTTON, lobbyMenuTrayLayout } from "../../src/ui/lobbyMenuLayout";
import { LOBBY_RAIL_BOUNDS, LOBBY_ACTION_BOUNDS } from "../../src/ui/lobbyLayout";
import { dialogueBubbleCenterY, dialogueBubbleHeight } from "../../src/ui/dialogueBubbleLayout";

describe("관문 전·후 대사", () => {
  it("표의 모든 이야기가 실제 관문에 달리고 회고에서 찾아진다", () => {
    for (const [stageId, link] of Object.entries(STAGE_STORY_LINKS)) {
      expect(() => getStage(stageId)).not.toThrow();
      for (const id of [link.pre, link.post]) if (id) expect(getRecollectionStory(id).id).toBe(id);
    }
  });

  it("이야기 ID는 겹치지 않고 모든 묶음이 끝까지 흐른다", () => {
    const ids = MAIN_STORY_BUNDLES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const story of MAIN_STORY_BUNDLES) {
      expect(() => new DialogueFlow(story)).not.toThrow();
      expect(dialogueStandingOrder(story).length).toBeGreaterThanOrEqual(0);
      // 모든 노드가 시작에서 닿는다.
      const byId = new Map(story.nodes.map((node) => [node.id, node]));
      const seen = new Set<string>();
      const walk = (id: string): void => {
        if (seen.has(id)) return;
        seen.add(id);
        const node = byId.get(id)!;
        if (node.nextId) walk(node.nextId);
        for (const choice of node.choices ?? []) if (choice.nextId) walk(choice.nextId);
      };
      walk(story.startNodeId);
      expect(seen.size, story.id).toBe(story.nodes.length);
    }
  });

  it("본 이야기는 다시 나오지 않는다", () => {
    expect(pendingPreStory("1-4", new Set())).toBe("stage-1-4-pre");
    expect(pendingPreStory("1-4", new Set(["stage-1-4-pre"]))).toBeUndefined();
    expect(pendingPostStory("1-3", new Set())).toBeUndefined();
  });

  it("회고 목록이 연결된 이야기를 하나도 빠뜨리지 않는다", () => {
    const listed = new Set(RECOLLECTION_ENTRIES.map(({ storyId }) => storyId));
    for (const story of MAIN_STORY_BUNDLES) expect(listed.has(story.id), story.id).toBe(true);
  });
});

describe("로비 메뉴 자리", () => {
  const dialogue = (bodyHeight: number) => {
    const height = dialogueBubbleHeight(bodyHeight);
    return { x: LOBBY_DIALOGUE.centerX, y: dialogueBubbleCenterY(LOBBY_DIALOGUE.bottom, height), width: LOBBY_DIALOGUE.width, height };
  };

  it("단추는 가방 아래에 서고 다른 입력면을 덮지 않는다", () => {
    expect(LOBBY_MENU_BUTTON.y).toBeGreaterThan(LOBBY_RAIL_BOUNDS.utility.inventory.y);
    for (const rail of [...Object.values(LOBBY_RAIL_BOUNDS.content), ...Object.values(LOBBY_RAIL_BOUNDS.utility)]) expect(lobbyBoundsIntersect(LOBBY_MENU_BUTTON, rail)).toBe(false);
    expect(lobbyBoundsIntersect(LOBBY_MENU_BUTTON, LOBBY_ACTION_BOUNDS.expedition)).toBe(false);
    expect(lobbyBoundsIntersect(LOBBY_MENU_BUTTON, LOBBY_ACTION_BOUNDS.sortie)).toBe(false);
  });

  it("로비 대사창은 단추를 덮지 않는다", () => {
    for (const body of [0, 30 * 3]) expect(lobbyBoundsIntersect(dialogue(body), LOBBY_MENU_BUTTON)).toBe(false);
  });

  it("가방과 단추의 간격은 다른 레일 칸 사이와 같다", () => {
    const bag = LOBBY_RAIL_BOUNDS.utility.inventory;
    const friends = LOBBY_RAIL_BOUNDS.utility.friends;
    expect(LOBBY_MENU_BUTTON.width).toBe(bag.width);
    expect(LOBBY_MENU_BUTTON.y - bag.y).toBe(bag.y - friends.y);
  });

  it("판은 사라진 단추 자리에 오른쪽 끝과 세로 중심을 맞춰 서고 칩이 판 안에 든다", () => {
    const { bounds, chips } = lobbyMenuTrayLayout(2);
    expect(bounds.x + bounds.width / 2).toBe(LOBBY_MENU_BUTTON.x + LOBBY_MENU_BUTTON.width / 2);
    expect(bounds.y).toBe(LOBBY_MENU_BUTTON.y);
    expect(bounds.x - bounds.width / 2).toBeGreaterThan(0);
    for (const chip of chips) expect(Math.abs(chip.x - bounds.x)).toBeLessThan(bounds.width / 2);
  });
});
