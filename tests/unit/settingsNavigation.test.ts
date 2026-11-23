import { describe, expect, it } from "vitest";
import { settingsLeaveStopKeys, validateSettingsOverlay, validateSettingsReturn } from "../../src/scenes/settingsNavigation";

describe("설정 반환 경로 검증", () => {
  it("허용하지 않은 씬과 반환 데이터는 로비로 제한한다", () => {
    expect(validateSettingsReturn({ returnScene: "battle", returnData: { section: "admin" } })).toEqual({ returnScene: "lobby" });
  });

  it("프리미엄의 등록된 섹션만 새 반환 데이터로 복사한다", () => {
    expect(validateSettingsReturn({ returnScene: "premium", returnData: { section: "premium", injected: true } })).toEqual({
      returnScene: "premium", returnData: { section: "premium" },
    });
    expect(validateSettingsReturn({ returnScene: "premium", returnData: { section: "unknown" } })).toEqual({ returnScene: "premium" });
  });
});

describe("설정 겹쳐 열기 검증", () => {
  it("목록에 있는 씬만 겹쳐 연 씬으로 받는다", () => {
    expect(validateSettingsOverlay({ overlayOf: "battle" })).toBe("battle");
    expect(validateSettingsOverlay({ overlayOf: "party" })).toBe("party");
    expect(validateSettingsOverlay({ overlayOf: "stageMap" })).toBe("stageMap");
    expect(validateSettingsOverlay({ overlayOf: "opening" })).toBe("opening");
    expect(validateSettingsOverlay({ overlayOf: "stageStory" })).toBe("stageStory");
    expect(validateSettingsOverlay({ overlayOf: "boot" })).toBeUndefined();
    expect(validateSettingsOverlay(undefined)).toBeUndefined();
  });
});

describe("설정에서 부트로 나갈 때 정리할 씬", () => {
  // Phaser 씬 상태: 5 RUNNING · 6 PAUSED · 7 SLEEPING · 8 SHUTDOWN
  it("잠들거나 멈춘 씬을 모두 멈추고, 설정 자신과 늘 떠 있는 겹 화면은 남긴다", () => {
    const scenes = [
      { key: "relics", status: 7 }, // 이야기 아래 잠든 도감
      { key: "stageStory", status: 7 }, // 설정 아래 잠든 이야기
      { key: "settings", status: 5 },
      { key: "effect-overlay", status: 5 },
      { key: "arenaNotice", status: 5 }, // 늘 떠 있는 알림 층은 건드리지 않는다
      { key: "battle", status: 6 },
      { key: "lobby", status: 8 },
    ];
    expect(settingsLeaveStopKeys(scenes, "settings", "effect-overlay")).toEqual(["relics", "stageStory", "battle"]);
  });
});
