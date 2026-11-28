import { describe, expect, it } from "vitest";
import { STAGE_MAP_NODE, stageNodeState, subNodeOffset } from "../../src/ui/stageMapNodeStyle";
import { STORY_PREVIEW, subStoryPreviewLayout } from "../../src/ui/nodeEnemyPreviewLayout";

describe("스토리 지도 노드 상태", () => {
  it("깬 곳이 잠김·차례보다 먼저다", () => {
    expect(stageNodeState({ unlocked: true, completed: true, current: true })).toBe("cleared");
    expect(stageNodeState({ unlocked: false, completed: false, current: true })).toBe("locked");
    expect(stageNodeState({ unlocked: true, completed: false, current: true })).toBe("current");
    expect(stageNodeState({ unlocked: true, completed: false, current: false })).toBe("open");
  });

  it("서브는 갈라져 나온 본편의 반대편으로, 본편보다 멀되 예전(360)보다 가깝게 선다", () => {
    expect(subNodeOffset(0)).toBe(STAGE_MAP_NODE.subOffset);
    expect(subNodeOffset(1)).toBe(-STAGE_MAP_NODE.subOffset);
    expect(STAGE_MAP_NODE.subOffset).toBeLessThan(360);
    expect(STAGE_MAP_NODE.subOffset - STAGE_MAP_NODE.mainOffset).toBeGreaterThan(STAGE_MAP_NODE.size);
  });
});

describe("글 서브 미리보기 배치", () => {
  it("줄거리 다음에 초회 보상이 오고, 보상이 없으면 그 칸을 내주지 않는다", () => {
    const withReward = subStoryPreviewLayout({ storyTextHeight: 120, rewardCount: 1 });
    expect(withReward.storyHeaderY!).toBeGreaterThan(withReward.titleY);
    expect(withReward.storyTextY!).toBeGreaterThan(withReward.storyHeaderY!);
    expect(withReward.rewardLabelY!).toBeGreaterThan(withReward.storyTextY! + 120);
    expect(withReward.rewardRowY!).toBeGreaterThan(withReward.rewardLabelY!);
    expect(withReward.height).toBeGreaterThanOrEqual(withReward.rewardRowY! + STORY_PREVIEW.reward.frame / 2);

    const none = subStoryPreviewLayout({ storyTextHeight: 120, rewardCount: 0 });
    expect(none.rewardRowY).toBeUndefined();
    expect(none.height).toBeLessThan(withReward.height);
  });
});
