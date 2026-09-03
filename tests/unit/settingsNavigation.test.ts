import { describe, expect, it } from "vitest";
import { validateSettingsReturn } from "../../src/scenes/settingsNavigation";

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
