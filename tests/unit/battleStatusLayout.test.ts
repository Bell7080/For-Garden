import { describe, expect, it } from "vitest";
import { BATTLE_PROFILE_LAYOUT, BATTLE_STATUS_LAYOUT, battleProfileBounds, statusBadgeOffsets } from "../../src/ui/battleStatusLayout";

/** Phaser 없이 1080×1920 전투 HUD의 상태 뱃지 간격 계약을 고정한다. */
describe("전투 상태 표시 배치", () => {
  it("기절과 출혈이 동시에 보이면 같은 크기의 뱃지를 고정 간격으로 나란히 둔다", () => {
    const offsets = statusBadgeOffsets(true);
    expect(Math.abs(offsets.stunX - offsets.bleedX)).toBe(BATTLE_STATUS_LAYOUT.badgeGap);
    expect(BATTLE_STATUS_LAYOUT.badgeGap).toBeGreaterThan(BATTLE_STATUS_LAYOUT.badgeSize);
  });

  it("출혈만 보일 때는 체력 바 옆의 첫 상태 자리를 사용한다", () => {
    expect(statusBadgeOffsets(false)).toEqual({ stunX: -62, bleedX: -62 });
  });
});

/** Phaser 없이 세 칸의 실제 bounds와 지도 하단 행동선 사이 계약을 고정한다. */
describe("공용 전투 프로필 배치", () => {
  it("전투와 20층 보스의 세 프로필은 같은 크기와 350 간격을 쓴다", () => {
    const { centersX, centerY, scale } = BATTLE_PROFILE_LAYOUT.battle;
    const bounds = centersX.map((x) => battleProfileBounds(x, centerY, scale));
    expect(centersX[1] - centersX[0]).toBe(350);
    expect(bounds.map(({ right, left }) => right - left)).toEqual([378, 378, 378]);
    expect(BATTLE_PROFILE_LAYOUT.hpTextBaselineY).toBe(180);
  });

  it("원정 지도는 동일 내부 기준선을 유지한 채 전체만 같은 배율로 줄인다", () => {
    const { centersX, centerY, scale } = BATTLE_PROFILE_LAYOUT.expedition;
    const bounds = centersX.map((x) => battleProfileBounds(x, centerY, scale));
    expect(bounds.map(({ right, left }) => right - left)).toEqual([287.28, 287.28, 287.28]);
    expect(centersX[1] - centersX[0]).toBe(320);
    // 세 번째 프로필까지 화면 폭 안에 있고 하단 출격 버튼과도 겹치지 않는다.
    expect(bounds[2].right).toBeLessThanOrEqual(1080);
    expect(Math.max(...bounds.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.sortieButton.top);
  });
});
