import { describe, expect, it } from "vitest";
import { BATTLE_PROFILE_LAYOUT, BATTLE_STATUS_LAYOUT, battleBuffChipBounds, battleProfileBounds, statusBadgeOffsets } from "../../src/ui/battleStatusLayout";

/** Phaser 없이 1080×1920 전투 HUD의 상태 뱃지 간격 계약을 고정한다. */
describe("전투 상태 표시 배치", () => {
  it("기절과 출혈이 동시에 보이면 같은 크기의 뱃지를 고정 간격으로 나란히 둔다", () => {
    const offsets = statusBadgeOffsets(true);
    expect(Math.abs(offsets.stunX - offsets.bleedX)).toBe(BATTLE_STATUS_LAYOUT.badgeGap);
    expect(BATTLE_STATUS_LAYOUT.badgeGap).toBeGreaterThan(BATTLE_STATUS_LAYOUT.badgeSize);
  });

  it("출혈만 보일 때는 체력 바 옆의 첫 상태 자리를 사용한다", () => {
    expect(statusBadgeOffsets(false)).toEqual({ stunX: -62, bleedX: -62, overpaintX: -62 });
  });

  it("켜진 상태만 한 칸씩 바깥으로 밀어 덧칠 뱃지가 겹치지 않는다", () => {
    const offsets = statusBadgeOffsets(true, true);
    expect(offsets.bleedX - offsets.stunX).toBe(-BATTLE_STATUS_LAYOUT.badgeGap);
    expect(offsets.overpaintX - offsets.bleedX).toBe(-BATTLE_STATUS_LAYOUT.badgeGap);
  });
});

/** Phaser 없이 세 칸의 실제 bounds와 지도 하단 행동선 사이 계약을 고정한다. */
describe("공용 전투 프로필 배치", () => {
  /** 카드·게이지는 서로 다른 정보를 담으므로 버프 액자와 픽셀 하나도 포개지 않게 고정한다. */
  it.each([1, BATTLE_PROFILE_LAYOUT.buffRow.maxVisible])("버프 %i개가 안전 영역 안에서 카드·HP·야성 게이지와 겹치지 않는다", (count) => {
    const row = Array.from({ length: count }, (_, slot) => battleBuffChipBounds(slot));
    const cardTop = -BATTLE_PROFILE_LAYOUT.glowSize / 2;
    expect(Math.max(...row.map(({ bottom }) => bottom))).toBeLessThan(cardTop);
    expect(Math.max(...row.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.hpBarY - BATTLE_PROFILE_LAYOUT.hpBarHeight / 2);
    expect(Math.max(...row.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.ferocityBarY - BATTLE_PROFILE_LAYOUT.ferocityBarHeight / 2);
    for (const centerX of BATTLE_PROFILE_LAYOUT.battle.centersX) {
      expect(centerX + Math.min(...row.map(({ left }) => left))).toBeGreaterThanOrEqual(0);
      expect(centerX + Math.max(...row.map(({ right }) => right))).toBeLessThanOrEqual(1080);
      expect(BATTLE_PROFILE_LAYOUT.battle.centerY + Math.min(...row.map(({ top }) => top))).toBeGreaterThanOrEqual(0);
    }
  });

  it("전투와 20층 보스의 세 프로필은 같은 크기와 350 간격을 쓴다", () => {
    const { centersX, centerY, scale } = BATTLE_PROFILE_LAYOUT.battle;
    const bounds = centersX.map((x) => battleProfileBounds(x, centerY, scale));
    expect(centersX[1] - centersX[0]).toBe(350);
    expect(bounds.map(({ right, left }) => right - left)).toEqual([378, 378, 378]);
    expect(BATTLE_PROFILE_LAYOUT.hpTextBaselineY).toBe(180);
  });

  /** 1080×1920 캡처에서 전장 HP, 궁극기 입력, 결과 UI가 서로 침범하지 않는 세로 계약이다. */
  it("버프 행과 프로필 입력은 전장 HP 바 및 결과 UI 안전 영역과 겹치지 않는다", () => {
    const { battle, collisionZones } = BATTLE_PROFILE_LAYOUT;
    const profile = battleProfileBounds(battle.centersX[1], battle.centerY, battle.scale, true);
    expect(collisionZones.battlefieldHpBottom).toBeLessThan(collisionZones.ultimateInputTop);
    expect(profile.top).toBeGreaterThanOrEqual(collisionZones.ultimateInputTop);
    expect(collisionZones.resultUiTop).toBeLessThan(BATTLE_PROFILE_LAYOUT.sortieButton.top);
  });

  it("원정 지도는 전투와 같은 크기·가로 기준선을 쓰고 세로만 출격 줄 위로 올린다", () => {
    const map = BATTLE_PROFILE_LAYOUT.expedition;
    const battle = BATTLE_PROFILE_LAYOUT.battle;
    // 같은 세 칸이 화면마다 다른 크기로 보이지 않도록 배율과 가로 자리를 전투와 공유한다.
    expect(map.scale).toBe(battle.scale);
    expect(map.centersX).toEqual(battle.centersX);
    const bounds = map.centersX.map((x) => battleProfileBounds(x, map.centerY, map.scale));
    expect(bounds.map(({ right, left }) => right - left)).toEqual([378, 378, 378]);
    // 세 번째 프로필까지 화면 폭 안에 있고 하단 출격 버튼과도 겹치지 않는다.
    expect(bounds[0].left).toBeGreaterThanOrEqual(0);
    expect(bounds[2].right).toBeLessThanOrEqual(1080);
    expect(Math.max(...bounds.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.sortieButton.top);
  });
});
