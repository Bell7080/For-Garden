import { describe, expect, it } from "vitest";
import { battlePauseActions } from "../../src/core/battlePauseMenu";
import { validateSettingsOverlay } from "../../src/scenes/settingsNavigation";
import { BATTLE_CLOCK_LAYOUT, BATTLE_PAUSE_BUTTON, RAID_BATTLE_HUD } from "../../src/ui/battleStatusLayout";

describe("전투 일시 정지 판", () => {
  it("은 이긴 판에서만 스테미나를 쓰는 콘텐츠에만 다시 하기와 나가기를 세운다", () => {
    for (const mode of ["stage", "cake", "bounty"] as const) expect(battlePauseActions(mode)).toEqual({ retry: true, exit: "leave" });
  });

  it("은 친 만큼이 점수인 판에서 다시 하기를 빼고 나가기를 지금까지의 피해로 끝내는 조작으로 둔다", () => {
    for (const mode of ["raid", "expeditionBoss"] as const) expect(battlePauseActions(mode)).toEqual({ retry: false, exit: "forfeit" });
  });

  it("은 원정 노드에서 그만두는 조작을 두지 않는다 — 스무 층 한 판이 통째로 끝난다", () => {
    expect(battlePauseActions("expedition")).toEqual({ retry: false, exit: null });
  });
});

describe("전투 일시 정지 버튼 자리", () => {
  it("은 화면 안의 오른쪽 위 구석이고 시계·레이드 체력 줄과 겹치지 않는다", () => {
    const { x, y, size } = BATTLE_PAUSE_BUTTON;
    expect(x + size / 2).toBeLessThanOrEqual(1080);
    expect(y - size / 2).toBeGreaterThanOrEqual(0);
    // 레이드 체력 줄의 오른쪽 끝보다 바깥에 선다.
    expect(x - size / 2).toBeGreaterThan(RAID_BATTLE_HUD.centerX + RAID_BATTLE_HUD.bar.width / 2);
    // 가운데 시계와는 멀리 떨어져 있다.
    expect(x - size / 2 - BATTLE_CLOCK_LAYOUT.x).toBeGreaterThan(200);
  });
});

describe("겹쳐 여는 설정", () => {
  it("은 알려진 씬만 깨운다", () => {
    expect(validateSettingsOverlay({ overlayOf: "battle" })).toBe("battle");
    expect(validateSettingsOverlay({ overlayOf: "lobby" })).toBeUndefined();
    expect(validateSettingsOverlay(undefined)).toBeUndefined();
  });
});
