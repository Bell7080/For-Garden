import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  RAID_ACTIONS, RAID_BOARD, RAID_BOARD_PLATE, RAID_BOSS_SPOT, RAID_HP_BAR,
  raidBoardViewport, raidSortieBackGap,
} from "../../src/ui/raidLayout";

describe("레이드 배치표", () => {
  it("보스는 발끝을 화면 밖으로 내보내고 상반신만 남긴다", () => {
    // 원정 기록 화면과 같은 문법이다 — 상자에 맞춰 줄이면 얼굴보다 여백이 먼저 읽힌다.
    expect(RAID_BOSS_SPOT.groundY).toBeGreaterThan(BASE_HEIGHT);
    const top = RAID_BOSS_SPOT.groundY - RAID_BOSS_SPOT.height;
    expect(top).toBeGreaterThan(0);
    // 머리 끝이 제목 줄 아래에서 시작해 머리글을 덮지 않는다.
    expect(top).toBeGreaterThan(RAID_HP_BAR.labelY - RAID_HP_BAR.width);
  });

  it("원화가 잠기는 띠가 남은 체력 줄을 덮고 목록 윗변에서 끝난다", () => {
    // 자르지 않고 잠근다 — 자르면 그 선이 가로줄로 보이고, 그대로 두면 유리 줄 뒤로 다리가 비친다.
    expect(RAID_BOSS_SPOT.fade.top).toBeLessThan(RAID_HP_BAR.labelY);
    expect(RAID_BOSS_SPOT.fade.bottom).toBeGreaterThanOrEqual(RAID_HP_BAR.valueY);
    expect(RAID_BOSS_SPOT.fade.bottom).toBeLessThanOrEqual(RAID_BOARD.viewport.top);
  });

  it("출격이 화면 가운데에 홀로 서고 뒤로가기를 침범하지 않는다", () => {
    // 이 줄에 서는 것은 출격 하나뿐이다 — 상점 입구는 로비 출격판 밖 줄이 이미 갖는다.
    expect(RAID_ACTIONS.sortie.centerX).toBe(BASE_WIDTH / 2);
    expect(Object.keys(RAID_ACTIONS)).toEqual(["y", "sortie"]);
    expect(raidSortieBackGap()).toBeGreaterThan(0);
  });

  it("기여 목록이 흐르는 창이 하단 조작 위에서 끝난다", () => {
    const viewport = raidBoardViewport();
    expect(viewport.height).toBeGreaterThan(0);
    expect(RAID_BOARD.viewport.bottom).toBeLessThan(RAID_ACTIONS.y - RAID_ACTIONS.sortie.height / 2);
  });

  it("기여 목록의 제목표는 판 윗변에 걸터앉는다", () => {
    // 판 안에 들여 세우던 때는 같은 위계의 제목이 이 화면에서만 맨 글자처럼 섰다.
    expect(RAID_BOARD.titleY).toBe(RAID_BOARD_PLATE.top - 4);
    expect(RAID_BOARD.titleX).toBe((1080 - RAID_BOARD_PLATE.width) / 2);
    // 제목표(높이 52)가 남은 체력 수치 줄과 겹치지 않는다.
    expect(RAID_BOARD.titleY - 26).toBeGreaterThan(RAID_HP_BAR.valueY + 14);
  });
});
