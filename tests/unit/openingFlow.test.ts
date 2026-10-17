import { describe, expect, it } from "vitest";
import { openingPending } from "../../src/core/openingFlow";

describe("openingPending", () => {
  it("오프닝을 못 봤으면 대기", () => expect(openingPending(false, new Set(["1-1"]))).toBe(true));
  it("오프닝은 봤지만 1-1을 못 깼으면 대기", () => expect(openingPending(true, new Set())).toBe(true));
  it("1-1까지 깼으면 끝", () => expect(openingPending(true, new Set(["1-1"]))).toBe(false));
  it("배열도 받는다", () => expect(openingPending(true, ["1-1"])).toBe(false));
});
