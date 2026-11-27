import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 겹쳐 세우는 three.js 무대는 내릴 때 컨텍스트를 직접 돌려줘야 한다(`src/ui/webglStage.ts`).
 * 쥔 채 두면 연구를 연달아 돌릴수록 쌓여 브라우저가 가장 오래된 게임 캔버스를 거둔다 — 화면이 까맣게 굳는다.
 * 눈으로만 드러나는 일이라 소스 모양으로 지킨다.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("three.js 무대의 WebGL 컨텍스트", () => {
  it("연구 시네마틱은 부수기 전에 캔버스를 받아 두고 부순 뒤 돌려준다", () => {
    const source = read("src/ui/ResearchCinematic.ts");
    expect(source).toMatch(/collectCanvases\(this\.root\)[\s\S]*this\.instance\.destroy\(\)[\s\S]*releaseWebglCanvases\(canvases\)/);
  });

  it("SSR 전조도 내릴 때 돌려준다", () => {
    const source = read("src/ui/SsrOmenCinematic.ts");
    expect(source).toMatch(/collectCanvases\(built\.root\)[\s\S]*built\.omen\.dispose\(\)[\s\S]*releaseWebglCanvases\(canvases\)/);
  });

  it("WebGL2 확인용 컨텍스트를 화면마다 새로 만들지 않는다", () => {
    for (const path of ["src/ui/ResearchCinematic.ts", "src/ui/SsrOmenCinematic.ts"]) {
      expect(read(path)).not.toMatch(/getContext\(["']webgl2?["']\)/);
    }
  });
});
