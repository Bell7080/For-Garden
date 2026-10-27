import { describe, expect, it } from "vitest";
import { BATTLE_CONTRIBUTION_LAYOUT as L, battleContributionBounds, boundsOverlap, contributionCellX, contributionCellY, CONTRIBUTION_TOGGLE } from "../../src/ui/battleContributionLayout";
import { BATTLE_CONTROLS } from "../../src/ui/battleStatusLayout";

/** 순수 배치표가 1080×1920 전투 HUD의 예약 영역을 침범하지 않는지 고정한다. */
describe("battle contribution panel layout", () => {
  it("keeps collapsed and expanded bounds inside the reference viewport", () => {
    for (const bounds of [battleContributionBounds(false), battleContributionBounds(true)]) {
      expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.left + bounds.width).toBeLessThanOrEqual(1080); expect(bounds.top + bounds.height).toBeLessThanOrEqual(1920);
    }
  });

  it("gives all three category chips at least 72px touch size", () => {
    expect(L.categories.itemWidth).toBeGreaterThanOrEqual(72);
    expect(L.categories.height).toBeGreaterThanOrEqual(72);
    expect(L.categories.itemWidth * 3).toBeLessThanOrEqual(L.categories.width);
  });

  it("왼쪽 벽에 붙어 서고 상단 HUD·조작 줄·프로필을 가리지 않는다", () => {
    const panel = battleContributionBounds(true);
    expect(panel.left).toBe(0);
    for (const zone of [L.protected.stage, L.protected.bossHud, L.protected.controls, L.protected.profiles]) {
      expect(boundsOverlap(panel, zone)).toBe(false);
    }
  });

  it("다섯 칸이 세로로 겹치지 않고 판 안에 선다", () => {
    const panel = battleContributionBounds(true);
    expect(L.rows.count).toBe(5);
    for (let index = 1; index < L.rows.count; index += 1) {
      expect(contributionCellY(index) - contributionCellY(index - 1)).toBe(L.rows.height + L.rows.gap);
    }
    expect(contributionCellX()).toBeGreaterThanOrEqual(panel.left);
    expect(contributionCellX() + L.rows.width).toBeLessThanOrEqual(panel.left + panel.width);
    expect(contributionCellY(0)).toBeGreaterThanOrEqual(L.categories.top + L.categories.height);
    expect(contributionCellY(L.rows.count - 1) + L.rows.height).toBeLessThanOrEqual(panel.top + panel.height);
  });

  it("칸 안의 얼굴·글자·막대가 칸을 넘지 않고 서로 겹치지 않는다", () => {
    expect(L.face.x + L.face.size / 2).toBeLessThanOrEqual(L.text.x);
    expect(L.face.y + L.face.size / 2).toBeLessThan(L.bar.y - L.bar.height / 2);
    expect(L.text.valueY).toBeLessThan(L.bar.y - L.bar.height / 2);
    expect(L.bar.y + L.bar.height / 2).toBeLessThanOrEqual(L.rows.height);
    expect((L.rows.width - L.bar.width) / 2).toBeGreaterThanOrEqual(0);
    expect(L.face.size).toBeLessThan(100);
  });

  it("접으면 판이 화면 왼쪽으로 완전히 나간다", () => {
    const panel = battleContributionBounds(true);
    expect(L.slideOutX + panel.left + panel.width).toBeLessThanOrEqual(0);
  });

  it("여는 칩은 배속 칩과 같은 가로선의 왼쪽 끝에 선다", () => {
    expect(CONTRIBUTION_TOGGLE.y).toBe(BATTLE_CONTROLS.rowY);
    expect(CONTRIBUTION_TOGGLE.x).toBeLessThan(BATTLE_CONTROLS.speedX);
    expect(CONTRIBUTION_TOGGLE.width).toBeLessThanOrEqual(180);
    expect(CONTRIBUTION_TOGGLE.height).toBeLessThanOrEqual(80);
    expect(battleContributionBounds(false)).toMatchObject({ width: CONTRIBUTION_TOGGLE.width, height: CONTRIBUTION_TOGGLE.height });
  });
});
