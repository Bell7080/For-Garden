import { describe, expect, it } from "vitest";
import { formatCurrency } from "../../src/core/formatCurrency";

describe("재화 표기", () => {
  it("는 만 미만이면 자릿수를 그대로 적는다", () => {
    expect([formatCurrency(0), formatCurrency(940), formatCurrency(9999)]).toEqual(["0", "940", "9,999"]);
  });

  it("는 만부터 K, 백만부터 M으로 줄인다", () => {
    expect([formatCurrency(10_000), formatCurrency(25_400), formatCurrency(999_900)]).toEqual(["10K", "25.4K", "999.9K"]);
    expect([formatCurrency(1_000_000), formatCurrency(12_340_000)]).toEqual(["1M", "12.3M"]);
    expect(formatCurrency(2_500_000_000)).toBe("2.5B");
  });

  it("는 올려 적지 않는다. 9,999,999는 아직 10M이 아니다", () => {
    expect(formatCurrency(9_999_999)).toBe("9.9M");
  });

  it("는 렐릭 상단의 큰 치즈케이크 수량도 칸 경계에 맞춰 줄인다", () => {
    // 9,999까지는 전체 숫자를 보이고 다음 정수부터 고정 폭 단위를 사용한다.
    expect([formatCurrency(9_999), formatCurrency(10_000), formatCurrency(1_000_000)]).toEqual(["9,999", "10K", "1M"]);
  });

  it("는 소수와 음수도 정수로 끊어 적는다", () => {
    expect([formatCurrency(1234.7), formatCurrency(-12_500)]).toEqual(["1,234", "-12.5K"]);
  });
});
