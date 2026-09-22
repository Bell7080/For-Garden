import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  RAID_ACTIONS, RAID_BOARD, RAID_BOSS_SPOT, RAID_HP_BAR, RAID_PREPARATION,
  raidActionGaps, raidBoardViewport,
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

  it("출격이 화면 가운데에 서고 좌우 어느 쪽과도 겹치지 않는다", () => {
    expect(RAID_ACTIONS.sortie.centerX).toBe(BASE_WIDTH / 2);
    // 판 밖 곁들임 줄(전리품 상점)과 우하단 공용 뒤로가기 사이에 실제 여백이 남는다.
    const gaps = raidActionGaps();
    expect(gaps.shop).toBeGreaterThan(0);
    expect(gaps.back).toBeGreaterThan(0);
  });

  it("기여 목록이 흐르는 창이 하단 조작 위에서 끝난다", () => {
    const viewport = raidBoardViewport();
    expect(viewport.height).toBeGreaterThan(0);
    expect(RAID_BOARD.viewport.bottom).toBeLessThan(RAID_ACTIONS.y - RAID_ACTIONS.sortie.height / 2);
  });

  it("편성 단계가 제목 · 세 칸 · 목록 · 시작 버튼 순서로 쌓인다", () => {
    const { titleY, slots, roster, hintY, start } = RAID_PREPARATION;
    expect(titleY).toBeLessThan(slots.y - slots.height / 2);
    // 목록은 편성판 아래에서 시작해 안내 문구 위에서 끝난다.
    expect(roster.top).toBeGreaterThanOrEqual(slots.y + slots.height / 2);
    expect(roster.bottom).toBeLessThan(hintY);
    expect(hintY).toBeLessThan(start.y - start.height / 2);
    // 시작 버튼은 화면 안에 온전히 든다.
    expect(start.y + start.height / 2).toBeLessThan(BASE_HEIGHT);
    // 세 칸이 같은 간격으로 서고 양 끝이 화면 안이다.
    expect(slots.firstX - slots.width / 2).toBeGreaterThan(0);
    expect(slots.firstX + slots.stepX * 2 + slots.width / 2).toBeLessThan(BASE_WIDTH);
  });
});
