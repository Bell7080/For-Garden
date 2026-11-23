import { describe, expect, it } from "vitest";
import { runeBrowseNeighbor, runeBrowsePosition, runeBrowseSwipe } from "../../src/core/runeBrowse";

const order = ["a", "b", "c", "d"];
const all = () => true;

describe("룬 좌우 넘기기", () => {
  it("가방 순서대로 옆 룬을 고르고 끝에서는 돌지 않는다", () => {
    expect(runeBrowseNeighbor(order, "b", 1, all)).toBe("c");
    expect(runeBrowseNeighbor(order, "b", -1, all)).toBe("a");
    expect(runeBrowseNeighbor(order, "a", -1, all)).toBeUndefined();
    expect(runeBrowseNeighbor(order, "d", 1, all)).toBeUndefined();
  });

  it("사라진 룬은 건너뛰고 위치 표기도 같은 셈을 읽는다", () => {
    const exists = (id: string) => id !== "c";
    expect(runeBrowseNeighbor(order, "b", 1, exists)).toBe("d");
    expect(runeBrowsePosition(order, "d", exists)).toEqual({ index: 3, total: 3 });
    expect(runeBrowsePosition(order, "a", all)).toEqual({ index: 1, total: 4 });
  });

  it("순서에 없는 룬은 넘기지 않는다", () => {
    expect(runeBrowsePosition(order, "z", all)).toBeUndefined();
    expect(runeBrowseNeighbor(order, "z", 1, all)).toBeUndefined();
  });

  it("가로로 충분히 쓸어야 넘기고, 왼쪽으로 쓸면 다음이다", () => {
    expect(runeBrowseSwipe(-200, 10)).toBe(1);
    expect(runeBrowseSwipe(200, 10)).toBe(-1);
    expect(runeBrowseSwipe(60, 0)).toBe(0);
    expect(runeBrowseSwipe(150, 140)).toBe(0);
  });
});
