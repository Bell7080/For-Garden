import { describe, expect, it } from "vitest";
import {
  clampExpeditionMapOffset,
  EXPEDITION_AUGMENT_POPUP,
  EXPEDITION_LAYOUT,
  expeditionLayoutGaps,
  expeditionMapWorldHeight,
  expeditionNodePosition,
  focusExpeditionFloor,
} from "../../src/ui/expeditionLayout";
import { BATTLE_PROFILE_LAYOUT, battleProfileBounds } from "../../src/ui/battleStatusLayout";
import { anchorEnemyPreview, enemyPreviewColumns, isEnemyPreviewNodeVisible, NODE_ENEMY_PREVIEW } from "../../src/ui/nodeEnemyPreviewLayout";

describe("expedition portrait layout", () => {
  it("keeps rewards, nodes, augments, relic HUD, and actions in separate vertical regions", () => {
    // 실제 씬과 공유하는 배치표를 검사해 텍스트나 노드 크기 변경이 이웃 HUD를 침범하지 않게 한다.
    expect(expeditionLayoutGaps().every((gap) => gap >= 20)).toBe(true);
    expect(EXPEDITION_LAYOUT.rewards.top).toBeGreaterThanOrEqual(96);
    expect(EXPEDITION_LAYOUT.actions.bottom).toBeLessThanOrEqual(1920);
    // 생존 HUD 구역은 실제로 세워지는 전투 프로필 세 칸의 bounds와 어긋나지 않는다.
    const { centersX, centerY, scale } = BATTLE_PROFILE_LAYOUT.expedition;
    const profiles = centersX.map((x) => battleProfileBounds(x, centerY, scale));
    expect(Math.min(...profiles.map(({ top }) => top))).toBeGreaterThanOrEqual(EXPEDITION_LAYOUT.relics.top);
    expect(Math.max(...profiles.map(({ bottom }) => bottom))).toBeLessThanOrEqual(EXPEDITION_LAYOUT.relics.bottom);
  });

  it("증강 선택판은 생존 HUD를 가리지 않고 그 위에서 멈춘다", () => {
    // 개인 대상은 판 안이 아니라 아래 HUD에서 고르므로 판이 그 줄을 덮으면 선택 자체가 막힌다.
    const bottom = EXPEDITION_AUGMENT_POPUP.centerY + EXPEDITION_AUGMENT_POPUP.height / 2;
    expect(bottom).toBeLessThanOrEqual(EXPEDITION_LAYOUT.relics.top - 20);
    expect(EXPEDITION_AUGMENT_POPUP.centerY - EXPEDITION_AUGMENT_POPUP.height / 2).toBeGreaterThanOrEqual(EXPEDITION_LAYOUT.rewards.bottom - 60);
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

  it("지도 마스크 안에서 편성판을 위아래로 뒤집고 꼬리는 선택 노드를 향한다", () => {
    // 상단 노드는 아래 배치, 하단 노드는 위 배치가 되며 판 전체가 지도 안전 영역을 넘지 않는다.
    const nearTop = anchorEnemyPreview(EXPEDITION_LAYOUT.map.top + 80, EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.bottom);
    const nearBottom = anchorEnemyPreview(EXPEDITION_LAYOUT.map.bottom - 80, EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.bottom);
    expect(nearTop.above).toBe(false); expect(nearBottom.above).toBe(true);
    for (const anchor of [nearTop, nearBottom]) {
      expect(anchor.y - NODE_ENEMY_PREVIEW.height / 2).toBeGreaterThanOrEqual(EXPEDITION_LAYOUT.map.top);
      expect(anchor.y + NODE_ENEMY_PREVIEW.height / 2).toBeLessThanOrEqual(EXPEDITION_LAYOUT.map.bottom);
    }
  });

  it.each([1, 3, 5])("%i기 SD 편성이 판 안에서 대칭이고 서로 겹치지 않는다", (count) => {
    // 정예/일반/군집 및 단독 폰투스가 같은 계산을 써도 가장자리와 슬롯 간격을 보존한다.
    const columns = enemyPreviewColumns(count);
    expect(columns).toHaveLength(count); expect(columns[0] + columns[count - 1]).toBe(0);
    expect(columns.every((x) => Math.abs(x) <= NODE_ENEMY_PREVIEW.width / 2 - 60)).toBe(true);
    expect(columns.slice(1).every((x, index) => x > columns[index])).toBe(true);
  });

  it("스크롤된 선택 노드가 지도 마스크를 벗어난 동안 미리보기를 숨긴다", () => {
    // 경계선 위는 보이고 한 픽셀이라도 바깥으로 나간 노드는 판과 SD 모두 숨기는 계약이다.
    expect(isEnemyPreviewNodeVisible(EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.bottom)).toBe(true);
    expect(isEnemyPreviewNodeVisible(EXPEDITION_LAYOUT.map.bottom, EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.bottom)).toBe(true);
    expect(isEnemyPreviewNodeVisible(EXPEDITION_LAYOUT.map.top - 1, EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.bottom)).toBe(false);
    expect(isEnemyPreviewNodeVisible(EXPEDITION_LAYOUT.map.bottom + 1, EXPEDITION_LAYOUT.map.top, EXPEDITION_LAYOUT.map.bottom)).toBe(false);
  });
});
