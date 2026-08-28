import { describe, expect, it } from "vitest";
import { findKeyword, KEYWORDS, parseKeywordText } from "../../src/data/keywords";

describe("스킬 설명 키워드", () => {
  it("는 링크 조각과 일반 글을 순서대로 가른다", () => {
    const segments = parseKeywordText("적에게 [[burn]] 피해를 입히고 [[guard|단단한 자세]]를 얻는다.");
    expect(segments.map((segment) => segment.text)).toEqual(["적에게 ", "화상", " 피해를 입히고 ", "단단한 자세", "를 얻는다."]);
    expect(segments[1].keyword?.id).toBe("burn");
    expect(segments[3].keyword?.id).toBe("guard");
    expect(segments[0].keyword).toBeUndefined();
  });

  it("는 사전에 없는 id를 링크로 만들지 않고 글자만 남긴다", () => {
    const segments = parseKeywordText("[[unknown-keyword|가짜]] 효과");
    expect(segments[0]).toEqual({ text: "가짜", keyword: undefined });
  });

  it("의 id는 서로 겹치지 않는다", () => {
    expect(new Set(KEYWORDS.map((keyword) => keyword.id)).size).toBe(KEYWORDS.length);
    expect(findKeyword("burn")?.kind).toBe("디버프");
  });

  it("는 스킬마다 다른 피해 수치 설명을 같은 링크 문법으로 연결한다", () => {
    const contextual = [{ id: "damage-value", term: "384", kind: "규칙" as const, description: "현재 방어력에서 300%를 받아 계산했다." }];
    const [segment] = parseKeywordText("[[damage-value|384]]", contextual);
    expect(segment.keyword).toEqual(contextual[0]);
  });
});
