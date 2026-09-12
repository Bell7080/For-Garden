import { describe, expect, it } from "vitest";
import { BATTLE_CONTRIBUTION_LAYOUT as L, battleContributionBounds, boundsOverlap, contributionRowCenterY, CONTRIBUTION_TOGGLE } from "../../src/ui/battleContributionLayout";
import { BATTLE_CONTROLS } from "../../src/ui/battleStatusLayout";

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
    // 액자가 한눈에 읽힐 만큼 크다 — 여는 칩이 판 밖으로 나가 이 자리가 통째로 비었다.
    expect(L.face.size).toBeGreaterThanOrEqual(80);
  });

  it("접으면 판이 화면 왼쪽 밖으로 완전히 나간다", () => {
    const panel = battleContributionBounds(true);
    // 판 폭만큼만 밀면 화면 왼쪽 여백(panel.left)이 그대로 남아 오른쪽 변이 전장에 걸친다.
    expect(L.slideOutX + panel.left + panel.width).toBeLessThanOrEqual(0);
  });

  it("여는 칩은 배속 칩과 같은 열·같은 크기로 전투 조작 줄에 선다", () => {
    expect(CONTRIBUTION_TOGGLE.x).toBe(BATTLE_CONTROLS.speedX);
    // 배속 바로 위 한 칸(자동 궁극기 위의 연출 칩과 같은 간격)이다.
    expect(CONTRIBUTION_TOGGLE.y).toBe(BATTLE_CONTROLS.rowY - BATTLE_CONTROLS.stackGap);
    expect(CONTRIBUTION_TOGGLE.width).toBeLessThanOrEqual(180);
    expect(CONTRIBUTION_TOGGLE.height).toBeLessThanOrEqual(80);
    // 접힌 상태에서 화면에 남는 것이 곧 그 칩이다.
    expect(battleContributionBounds(false)).toMatchObject({ width: CONTRIBUTION_TOGGLE.width, height: CONTRIBUTION_TOGGLE.height });
  });

  it("줄은 겹치지 않고 판 안에서 순서대로 내려간다", () => {
    for (let index = 1; index < L.rows.count; index += 1) {
      expect(contributionRowCenterY(index) - contributionRowCenterY(index - 1)).toBe(L.rows.height + L.rows.gap);
    }
    const panel = battleContributionBounds(true);
    expect(contributionRowCenterY(0) - L.rows.height / 2).toBeGreaterThanOrEqual(L.categories.top + L.categories.height);
    expect(contributionRowCenterY(L.rows.count - 1) + L.bar.offsetY).toBeLessThanOrEqual(panel.top + panel.height);
  });
});
