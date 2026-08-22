import { describe, expect, it } from "vitest";
import { capabilitiesFor } from "../../src/core/infoCapabilities";

/** 표시 문맥별 허용 범위가 성장 입력을 실수로 다시 노출하지 않도록 고정한다. */
describe("정보창 권한", () => {
  it("소유자만 플레이어 세션을 변경할 수 있다", () => {
    expect(capabilitiesFor("owner").mutateProgress).toBe(true);
    expect(capabilitiesFor("friend").mutateProgress).toBe(false);
    expect(capabilitiesFor("enemy").mutateProgress).toBe(false);
  });

  it("친구와 적은 유대 정보를 공개하지 않는다", () => {
    expect(capabilitiesFor("friend").showBond).toBe(false);
    expect(capabilitiesFor("enemy")).toMatchObject({ showBond: false, showGrowth: false, showRuntimeCombat: true });
  });
});
