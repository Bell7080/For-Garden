import { describe, expect, it } from "vitest";
import { rollEndpoints, rollText } from "../../src/core/valueRoll";

describe("재화 숫자 굴리기", () => {
  it("쉼표와 상한 꼴을 지킨다", () => {
    expect(rollEndpoints("1,000", "2,500")).toEqual([1000, 2500]);
    expect(rollText("2,500", 1750)).toBe("1,750");
    expect(rollText("64/122", 50)).toBe("50/122");
  });
  it("K/M 접미사와 소수 자리를 지킨다", () => {
    expect(rollEndpoints("1.2K", "3.4K")).toEqual([1200, 3400]);
    expect(rollText("3.4K", 2300)).toBe("2.3K");
  });
  it("같은 값이나 숫자가 없으면 굴리지 않는다", () => {
    expect(rollEndpoints("10", "10")).toBeUndefined();
    expect(rollEndpoints("", "10")).toBeUndefined();
  });
});
