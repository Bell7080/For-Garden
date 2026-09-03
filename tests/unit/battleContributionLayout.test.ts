import { describe, expect, it } from "vitest";
import { BATTLE_CONTRIBUTION_LAYOUT as L, battleContributionBounds, boundsOverlap } from "../../src/ui/battleContributionLayout";

/** 순수 배치표가 1080×1920 전투 HUD의 예약 영역을 침범하지 않는지 고정한다. */
describe("battle contribution panel layout", () => {
  it("keeps collapsed and expanded bounds inside the reference viewport", () => {
    for (const bounds of [battleContributionBounds(false), battleContributionBounds(true)]) {
      expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.left + bounds.width).toBeLessThanOrEqual(1080); expect(bounds.top + bounds.height).toBeLessThanOrEqual(1920);
    }
    expect(battleContributionBounds(true).width).toBeGreaterThanOrEqual(320);
    expect(battleContributionBounds(true).width).toBeLessThanOrEqual(380);
    expect(battleContributionBounds(true).height).toBeLessThanOrEqual(760);
  });

  it("gives all three category chips at least 72px touch width", () => {
    expect(L.categories.itemWidth).toBeGreaterThanOrEqual(72);
    expect(L.categories.height).toBeGreaterThanOrEqual(72);
    expect(L.categories.itemWidth * 3).toBeLessThanOrEqual(L.categories.width);
  });

  it("fits five rows and avoids stage, boss HUD, and bottom profiles", () => {
    const panel = battleContributionBounds(true);
    const lastRowBottom = L.rows.top + (L.rows.count - 1) * (L.rows.height + L.rows.gap) + L.rows.height;
    expect(L.rows.count).toBe(5); expect(lastRowBottom).toBeLessThanOrEqual(panel.top + panel.height);
    expect(boundsOverlap(panel, L.protected.stage)).toBe(false);
    expect(boundsOverlap(panel, L.protected.bossHud)).toBe(false);
    expect(boundsOverlap(panel, L.protected.profiles)).toBe(false);
  });

  it("행 왼쪽 얼굴 액자를 판 안에 두고 이름 열과 겹치지 않게 한다", () => {
    const panel = battleContributionBounds(true);
    const left = L.face.x - L.face.size / 2;
    const right = L.face.x + L.face.size / 2;
    // 액자는 판 왼쪽 여백에 선다 — 펼친 동안 그래프 칩이 사라지므로 그 자리가 비어 있다.
    expect(left).toBeGreaterThanOrEqual(panel.left);
    expect(right).toBeLessThanOrEqual(L.rows.left);
    // 마지막 행의 액자까지 판 아래를 넘지 않는다.
    const lastFaceBottom = L.rows.top + (L.rows.count - 1) * (L.rows.height + L.rows.gap) + L.face.offsetY + L.face.size / 2;
    expect(lastFaceBottom).toBeLessThanOrEqual(panel.top + panel.height);
    // 접힌 상태의 그래프 칩과 같은 x에 서므로, 칩이 남아 있으면 첫 액자를 덮는다는 뜻이다.
    expect(L.face.x).toBe(L.toggle.x);
  });
});
