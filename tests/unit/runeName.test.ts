import { describe, expect, it } from "vitest";
import { MAX_RUNE_NAME_LENGTH, normalizeRuneName, runeNameProblem } from "../../src/core/runeName";

describe("룬 이름 규칙", () => {
  it("공백을 한 칸으로 줄이고 양끝을 다듬는다", () => {
    expect(normalizeRuneName("  붉은 \n\t 룬  ")).toBe("붉은 룬");
  });

  it("빈 이름·너무 긴 이름·제어 문자를 가른다", () => {
    expect(runeNameProblem("   ")).toBe("empty");
    expect(runeNameProblem("가".repeat(MAX_RUNE_NAME_LENGTH + 1))).toBe("tooLong");
    expect(runeNameProblem("룬‮")).toBe("invalid");
    expect(runeNameProblem("가".repeat(MAX_RUNE_NAME_LENGTH))).toBeUndefined();
  });

  it("이모지는 화면에 서는 글자 하나로 센다", () => {
    expect(runeNameProblem("🔥".repeat(MAX_RUNE_NAME_LENGTH))).toBeUndefined();
  });
});
