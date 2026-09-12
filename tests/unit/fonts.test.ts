import { describe, expect, it } from "vitest";
import INDEX_HTML from "../../index.html?raw";
import { LANGUAGE_IDS } from "../../src/core/language";
import {
  FONT_FACES, FONT_FALLBACK, FONT_FAMILY_NAME, FONT_WEIGHT, SCRIPT_FONTS,
  allScriptFontFaces, fontFamilyFor, fontStyleFor, scriptFontFaces,
} from "../../src/ui/fonts";

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

  it("의 대체 글꼴은 어느 언어에서나 맨 뒤에 온다", () => {
    for (const language of LANGUAGE_IDS) expect(fontFamilyFor(language).endsWith(FONT_FALLBACK)).toBe(true);
  });
});

describe("공용 글꼴 파일", () => {
  it("은 선언한 세 굵기가 모두 public/fonts에 있다", () => {
    expect(FONT_FACES.map((face) => face.weight).sort()).toEqual([500, 700, 800]);
    const present = Object.keys(FONT_FILES).map((path) => path.replace("../../public", ""));
    for (const face of FONT_FACES) expect(present).toContain(face.file);
  });

  it("은 전부 같은 가족이라 언어가 바뀌어도 숫자·영문이 흔들리지 않는다", () => {
    for (const face of FONT_FACES) expect(face.family).toBe(FONT_FAMILY_NAME);
  });

  it("은 index.html의 preload 목록과 정확히 같다", () => {
    // 언어별 보조 글꼴은 저장을 읽기 전이라 preload하지 않는다. 공용 세 벌만 미리 받는다.
    const preloaded = [...INDEX_HTML.matchAll(/rel="preload" href="([^"]+)"/g)].map((match) => match[1]);
    expect(preloaded).toEqual(FONT_FACES.map((face) => face.file));
  });
});

describe("언어별 보조 글꼴", () => {
  it("은 한국어·영어처럼 NEXON Kart가 다 그리는 언어에는 없다", () => {
    expect(scriptFontFaces("ko")).toEqual([]);
    expect(scriptFontFaces("en")).toEqual([]);
    // 태국 문자는 NEXON Kart가 이미 갖고 있어 따로 얹지 않는다.
    expect(scriptFontFaces("th")).toEqual([]);
  });

  it("은 한자·가나를 쓰는 언어마다 세 굵기를 같은 규칙으로 만든다", () => {
    for (const language of ["ja", "zh-Hant", "zh-Hans"] as const) {
      const faces = scriptFontFaces(language);
      const script = SCRIPT_FONTS[language]!;
      expect(faces.map((face) => face.weight).sort()).toEqual([500, 700, 800]);
      for (const face of faces) {
        expect(face.family).toBe(script.family);
        expect(face.file).toBe(`/fonts/${script.slug}-${face.weight}.woff2`);
      }
    }
  });

  it("은 CJK를 NEXON Kart 뒤에 세워 숫자·영문을 공용으로 남긴다", () => {
    for (const language of ["ja", "zh-Hant", "zh-Hans"] as const) {
      const stack = fontFamilyFor(language);
      expect(stack.indexOf(`"${FONT_FAMILY_NAME}"`)).toBeLessThan(stack.indexOf(`"${SCRIPT_FONTS[language]!.family}"`));
    }
  });

  it("은 베트남어만 NEXON Kart 앞에 세운다", () => {
    // NEXON Kart에 성조 글자가 없어 뒤에 두면 한 낱말 안에서 글자마다 글꼴이 갈린다.
    expect(SCRIPT_FONTS.vi?.order).toBe("before");
    const stack = fontFamilyFor("vi");
    expect(stack.indexOf(`"${SCRIPT_FONTS.vi!.family}"`)).toBeLessThan(stack.indexOf(`"${FONT_FAMILY_NAME}"`));
  });

  it("은 가족 이름과 파일 머리말이 언어끼리 겹치지 않는다", () => {
    const families = Object.values(SCRIPT_FONTS).map((script) => script!.family);
    const slugs = Object.values(SCRIPT_FONTS).map((script) => script!.slug);
    expect(new Set(families).size).toBe(families.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    // 공용 가족과 같은 이름을 쓰면 브라우저가 한쪽을 덮어쓴다.
    expect(families).not.toContain(FONT_FAMILY_NAME);
  });

  it("은 모든 언어를 합쳐도 파일 경로가 중복되지 않는다", () => {
    const files = allScriptFontFaces().map((face) => face.file);
    expect(new Set(files).size).toBe(files.length);
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
