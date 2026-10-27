import { describe, expect, it } from "vitest";
import { needsCharWrap, wrapByCharacter } from "../../src/core/cjkWrap";

const measure = (s: string): number => Array.from(s).length * 10;

describe("공백 없는 언어의 줄바꿈", () => {
  it("공백이 없는 일본어도 폭 안에서 끊는다", () => {
    const out = wrapByCharacter("これは長い日本語の文章でして、きれいに折り返されます。", 100, measure);
    for (const line of out.split("\n")) expect(measure(line)).toBeLessThanOrEqual(100);
    expect(out.replace(/\n/g, "")).toBe("これは長い日本語の文章でして、きれいに折り返されます。");
  });

  it("닫는 부호가 줄 머리에 서지 않고 여는 부호가 줄 끝에 서지 않는다", () => {
    const out = wrapByCharacter("あいうえおかきくけこ。さしすせそ「たちつてと」", 100, measure);
    for (const line of out.split("\n")) {
      expect(line[0]).not.toMatch(/[。」]/);
      expect(line[line.length - 1]).not.toBe("「");
    }
  });

  it("문단과 서양 낱말은 그대로 둔다", () => {
    expect(wrapByCharacter("abc def\nxyz", 100, measure)).toBe("abc def\nxyz");
    expect(needsCharWrap("Hello world")).toBe(false);
    expect(needsCharWrap("안녕하세요")).toBe(false);
    expect(needsCharWrap("こんにちは")).toBe(true);
  });
});
