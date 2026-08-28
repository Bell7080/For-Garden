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

  it("는 렉시아의 데이터 기반 출혈 표기를 기존 키워드 사전에 연결한다", () => {
    const linked = parseKeywordText("[[bleed|출혈]] 3초 · 매초 최대 체력 2%");
    expect(linked.find((segment) => segment.keyword)?.keyword).toMatchObject({ id: "bleed", kind: "디버프" });
  });

  it("는 스피나의 은신·연격·공격 속도 규칙을 모두 설명 팝업에 연결한다", () => {
    // 스킬 본문에서 실제 사용하는 표기들을 한꺼번에 검증해 일부만 평문으로 되돌아가는 회귀를 막는다.
    const linked = parseKeywordText("[[stealth|은신]] [[combo|연격]] [[attack-speed|공격 속도]] [[missing-hp|잃은 체력]]");
    expect(linked.filter((segment) => segment.keyword).map((segment) => segment.keyword?.id)).toEqual([
      "stealth", "combo", "attack-speed", "missing-hp",
    ]);
  });
});
