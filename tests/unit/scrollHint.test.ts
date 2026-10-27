import { describe, expect, it } from "vitest";
import { scrollHintSides } from "../../src/core/scrollHint";

describe("스크롤 힌트 규칙", () => {
  it("넘치지 않는 목록에는 표식이 없다", () => {
    expect(scrollHintSides({ offset: 0, min: 0 })).toEqual({ before: false, after: false });
    expect(scrollHintSides({ offset: 0, min: -5 })).toEqual({ before: false, after: false });
  });
  it("맨 앞에서는 뒤쪽만, 중간에서는 양쪽, 맨 끝에서는 앞쪽만 켠다", () => {
    expect(scrollHintSides({ offset: 0, min: -400 })).toEqual({ before: false, after: true });
    expect(scrollHintSides({ offset: -200, min: -400 })).toEqual({ before: true, after: true });
    expect(scrollHintSides({ offset: -400, min: -400 })).toEqual({ before: true, after: false });
  });
  it("끝에서 조금 떨어져 있어도 닿은 것으로 본다", () => {
    expect(scrollHintSides({ offset: -392, min: -400 })).toEqual({ before: true, after: false });
  });
  it("잘못된 값은 켜지 않는다", () => {
    expect(scrollHintSides({ offset: Number.NaN, min: -400 })).toEqual({ before: false, after: false });
  });
});
