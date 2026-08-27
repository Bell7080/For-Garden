import { describe, expect, it } from "vitest";
import { BATTLE_STATUS_LAYOUT, statusBadgeOffsets } from "../../src/ui/battleStatusLayout";

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
