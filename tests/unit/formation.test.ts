import { describe, expect, it } from "vitest";
import { moveFormationSlot } from "../../src/core/formation";

describe("moveFormationSlot", () => {
  it("채워진 두 슬롯을 교환한다", () => expect(moveFormationSlot(["a", "b", "c"], 0, 2)).toEqual(["c", "b", "a"]));
  it("빈 슬롯으로 옮기며 원래 슬롯을 비운다", () => expect(moveFormationSlot(["a", null, "c"], 0, 1)).toEqual([null, "a", "c"]));
  it("동일 슬롯은 값 변경 없이 새 배열을 반환한다", () => { const input = ["a", "b"]; const result = moveFormationSlot(input, 1, 1); expect(result).toEqual(input); expect(result).not.toBe(input); });
  it.each([[-1, 1], [0, 2], [0.5, 1]])("범위 밖 또는 정수가 아닌 입력 %s → %s를 무시한다", (from, to) => expect(moveFormationSlot(["a", "b"], from, to)).toEqual(["a", "b"]));
  it("입력 배열과 그 순서를 변경하지 않는다", () => { const input = Object.freeze(["a", "b", "c"]); moveFormationSlot(input, 0, 2); expect(input).toEqual(["a", "b", "c"]); });
});
