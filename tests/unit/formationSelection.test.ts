import { describe, expect, it } from "vitest";
import { removeFormationSlot } from "../../src/core/formationSelection";

describe("removeFormationSlot", () => {
  it("화면에서 누른 인덱스만 제거하고 뒤 슬롯을 당긴다", () => {
    // 같은 ID가 있어도 값 검색이 아니라 두 번째 자리 자체를 제거해야 한다.
    const formation = ["same", "same", "last"];
    expect(removeFormationSlot(formation, 1)).toBe(true);
    expect(formation).toEqual(["same", "last"]);
  });

  it("빈 자리 밖 인덱스는 배열을 변경하지 않는다", () => {
    const formation = ["first"];
    expect(removeFormationSlot(formation, 2)).toBe(false);
    expect(formation).toEqual(["first"]);
  });
});
