import { describe, it, expect } from "vitest";
import { wrapDialogueText } from "../../src/core/dialogueTextWrap";
import { LANGUAGE_IDS } from "../../src/core/language";

const measure = (value: string) => [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)].length;
describe("스토리 대사 줄바꿈", () => {
  it.each(LANGUAGE_IDS)("%s의 줄바꿈은 원문과 명시적 빈 줄을 보존한다", (language) => {
    const source = "Hello 연구원！今日は晴れです。 การเดินทางเริ่มต้นขึ้น\n\n다음 문장 café é 👨‍👩‍👧‍👦";
    const lines = wrapDialogueText(source, 12, measure, language);
    expect(lines.every((line) => measure(line) <= 12)).toBe(true);
    expect(lines.join("").replace(/\s/gu, "")).toBe(source.replace(/\s/gu, ""));
    expect(lines).toContain("");
  });
  it("라틴 단어는 빈칸에서 넘기고 긴 단어만 나눈다", () => {
    expect(wrapDialogueText("hello world", 6, measure, "en")).toEqual(["hello", "world"]);
    expect(wrapDialogueText("abcdefghijk", 4, measure, "en")).toEqual(["abcd", "efgh", "ijk"]);
  });
  it("결합 문자와 ZWJ 이모지는 긴 단어를 나눌 때도 깨지지 않는다", () => {
    const source = "éé👨‍👩‍👧‍👦👨‍👩‍👧‍👦";
    expect(wrapDialogueText(source, 1, measure, "en")).toEqual(["é", "é", "👨‍👩‍👧‍👦", "👨‍👩‍👧‍👦"]);
  });
  it("일본어·중국어 닫는 문장부호를 홀로 다음 줄에 세우지 않는다", () => {
    for (const language of ["ja", "zh-Hant", "zh-Hans"]) {
      const lines = wrapDialogueText("今日は晴れです。明日も来てね！", 6, measure, language);
      expect(lines.some((line) => /^[。！]/u.test(line))).toBe(false);
    }
  });
});
