import { describe, expect, it } from "vitest";
import { EXPEDITION_LAYOUT, expeditionLayoutGaps } from "../../src/ui/expeditionLayout";

describe("expedition portrait layout", () => {
  it("keeps rewards, nodes, augments, relic HUD, and actions in separate vertical regions", () => {
    // 실제 씬과 공유하는 배치표를 검사해 텍스트나 노드 크기 변경이 이웃 HUD를 침범하지 않게 한다.
    expect(expeditionLayoutGaps().every((gap) => gap >= 20)).toBe(true);
    expect(EXPEDITION_LAYOUT.rewards.top).toBeGreaterThanOrEqual(96);
    expect(EXPEDITION_LAYOUT.actions.bottom).toBeLessThanOrEqual(1920);
  });
});
