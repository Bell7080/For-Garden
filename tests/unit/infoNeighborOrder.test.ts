import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("정보창 옆으로 넘기기", () => {
  it("적·소환 전용 개체가 섞이지 않도록 도감에 서는 개체 목록만 순회한다", () => {
    const source = readFileSync(new URL("../../src/ui/info.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("private slideToNeighbor"));
    expect(body.slice(0, 400)).toContain("const order = PLAYABLE_RELICS;");
  });
});
