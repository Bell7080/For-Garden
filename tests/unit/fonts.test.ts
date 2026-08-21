import { describe, expect, it } from "vitest";
import INDEX_HTML from "../../index.html?raw";
import { FONT_FACES, FONT_FAMILY, FONT_FAMILY_NAME, FONT_WEIGHT, fontStyleFor } from "../../src/ui/fonts";

/** Node API 대신 Vite의 glob을 쓴다 — 브라우저 타입만 켜진 typecheck에서도 그대로 통과한다. */
const SOURCES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const FONT_FILES = import.meta.glob("../../public/fonts/*.woff2");

/** 글꼴 값을 직접 만져도 되는 두 파일. 나머지 전부는 역할만 고른다. */
const FONT_OWNERS = ["../../src/ui/fonts.ts", "../../src/ui/theme.ts"];

describe("글꼴 역할", () => {
  it("은 엑스트라볼드 > 볼드 > 미디움 세 단계로만 나뉜다", () => {
    expect(FONT_WEIGHT).toEqual({ display: 800, emphasis: 700, body: 500 });
    expect(fontStyleFor("display")).toBe("800");
    expect(fontStyleFor("emphasis")).toBe("700");
    expect(fontStyleFor("body")).toBe("500");
  });

  it("의 대체 글꼴은 항상 게임 글꼴 뒤에 온다", () => {
    expect(FONT_FAMILY.startsWith(`"${FONT_FAMILY_NAME}"`)).toBe(true);
  });
});

describe("글꼴 파일", () => {
  it("은 선언한 세 굵기가 모두 public/fonts에 있다", () => {
    expect(FONT_FACES.map((face) => face.weight).sort()).toEqual([500, 700, 800]);
    const present = Object.keys(FONT_FILES).map((path) => path.replace("../../public", ""));
    for (const face of FONT_FACES) expect(present).toContain(face.file);
  });

  it("은 index.html의 preload 목록과 정확히 같다", () => {
    const preloaded = [...INDEX_HTML.matchAll(/rel="preload" href="([^"]+)"/g)].map((match) => match[1]);
    expect(preloaded).toEqual(FONT_FACES.map((face) => face.file));
  });
});

describe("글꼴 사용 규칙", () => {
  it("은 fonts.ts와 theme.ts 밖에서 글꼴 이름·굵기를 직접 쓰지 못하게 한다", () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !FONT_OWNERS.includes(path))
      .filter(([, code]) => /fontFamily|fontStyle\s*:|font-family|font-weight/.test(code))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("은 모든 textStyle 호출이 역할을 고르게 한다", () => {
    const callsWithoutRole = Object.entries(SOURCES)
      .filter(([path]) => path !== "../../src/ui/theme.ts")
      .flatMap(([path, code]) =>
        code
          .split("\n")
          .map((line, index) => ({ line, at: `${path}:${index + 1}` }))
          .filter(({ line }) => line.includes("textStyle({") && !/textStyle\(\{ role: "(display|emphasis|body)"/.test(line))
          .map(({ at }) => at),
      );
    expect(callsWithoutRole).toEqual([]);
  });
});
