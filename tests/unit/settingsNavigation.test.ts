import { describe, expect, it } from "vitest";
import { validateSettingsOverlay, validateSettingsReturn } from "../../src/scenes/settingsNavigation";

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
    expect(validateSettingsOverlay({ overlayOf: "boot" })).toBeUndefined();
    expect(validateSettingsOverlay(undefined)).toBeUndefined();
  });
});
