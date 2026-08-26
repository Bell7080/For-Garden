import { describe, expect, it } from "vitest";
import {
  clampExpeditionMapOffset,
  EXPEDITION_LAYOUT,
  expeditionLayoutGaps,
  expeditionMapWorldHeight,
  expeditionNodePosition,
  focusExpeditionFloor,
} from "../../src/ui/expeditionLayout";

describe("expedition portrait layout", () => {
  it("keeps rewards, nodes, augments, relic HUD, and actions in separate vertical regions", () => {
    // 실제 씬과 공유하는 배치표를 검사해 텍스트나 노드 크기 변경이 이웃 HUD를 침범하지 않게 한다.
    expect(expeditionLayoutGaps().every((gap) => gap >= 20)).toBe(true);
    expect(EXPEDITION_LAYOUT.rewards.top).toBeGreaterThanOrEqual(96);
    expect(EXPEDITION_LAYOUT.actions.bottom).toBeLessThanOrEqual(1920);
  });

  it("세로 지도 월드는 뷰포트보다 크고 양 끝 스크롤을 넘지 않는다", () => {
    // 실제 지도 안전 영역으로 경계를 계산해 1층 아래와 20층 위의 빈 공간 노출을 막는다.
    const viewport = EXPEDITION_LAYOUT.map.bottom - EXPEDITION_LAYOUT.map.top;
    const world = expeditionMapWorldHeight();
    expect(world).toBeGreaterThan(viewport);
    expect(clampExpeditionMapOffset(500, viewport)).toBe(0);
    expect(clampExpeditionMapOffset(-world * 2, viewport)).toBe(viewport - world);
  });

  it("현재 도달 층 포커스는 중앙을 향하고 끝층에서는 경계에 고정된다", () => {
    // 중간 층은 정확히 중앙에 오며 시작/보스 층은 허용 스크롤 범위에서 멈춘다.
    const viewport = EXPEDITION_LAYOUT.map.bottom - EXPEDITION_LAYOUT.map.top;
    const middleFloor = 10;
    const middleOffset = focusExpeditionFloor(middleFloor, viewport);
    expect(expeditionNodePosition(middleFloor, 0).y + middleOffset).toBe(viewport / 2);
    expect(focusExpeditionFloor(1, viewport)).toBe(viewport - expeditionMapWorldHeight());
    expect(focusExpeditionFloor(20, viewport)).toBe(0);
  });
});
