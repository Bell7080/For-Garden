import { describe, expect, it } from "vitest";
import { validateSettingsReturn } from "../../src/scenes/settingsNavigation";

describe("설정 반환 경로 검증", () => {
  it("허용하지 않은 씬과 반환 데이터는 로비로 제한한다", () => {
    expect(validateSettingsReturn({ returnScene: "battle", returnData: { section: "admin" } })).toEqual({ returnScene: "lobby" });
  });

  it("상점의 등록된 섹션만 새 반환 데이터로 복사한다", () => {
    expect(validateSettingsReturn({ returnScene: "shop", returnData: { section: "premium", injected: true } })).toEqual({
      returnScene: "shop", returnData: { section: "premium" },
    });
    expect(validateSettingsReturn({ returnScene: "shop", returnData: { section: "unknown" } })).toEqual({ returnScene: "shop" });
  });
});
