import { describe, expect, it } from "vitest";
import { formatCountdown } from "../../src/core/formatCountdown";

describe("남은 시간 표기", () => {
  it("는 시·분·초를 두 자리로 적고 남은 1초 미만도 한 초로 보인다", () => {
    expect(formatCountdown(3 * 3_600_000 + 59 * 60_000 + 58_000)).toBe("03:59:58");
    expect(formatCountdown(1)).toBe("00:00:01");
  });

  it("는 24시간을 넘겨도 날짜처럼 되감지 않는다", () => {
    expect(formatCountdown(49 * 3_600_000 + 2 * 60_000 + 3_000)).toBe("49:02:03");
  });

  it("는 음수와 유한하지 않은 입력을 안전한 0으로 닫는다", () => {
    expect([formatCountdown(-1), formatCountdown(Number.NaN), formatCountdown(Number.POSITIVE_INFINITY)])
      .toEqual(["00:00:00", "00:00:00", "00:00:00"]);
  });
});
