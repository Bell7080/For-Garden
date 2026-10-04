import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HoloBar 기울기", () => {
  it("채움을 다시 그릴 때도 생성 때의 기울기를 읽는다 — `slant: 0` 게이지의 채움 끝이 `/`로 남지 않는다", () => {
    const source = readFileSync("src/ui/holo.ts", "utf8");
    const redraw = source.slice(source.indexOf("private redraw(): void {"));
    expect(redraw.slice(0, 200)).toContain("this.slant");
    expect(redraw.slice(0, 200)).not.toContain("HOLO.slant");
  });

  it("로비 패스 카드의 게이지는 눈금과 같은 `slant: 0`을 넘긴다", () => {
    expect(readFileSync("src/ui/LobbyPassCard.ts", "utf8")).toMatch(/new HoloBar\([^\n]*ticks:[^\n]*slant: 0/);
  });
});
