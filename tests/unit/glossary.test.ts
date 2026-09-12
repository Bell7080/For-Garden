import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_EXCEPTIONS, glossaryForm, type GlossaryId } from "../../src/i18n/glossary";
import { KO } from "../../src/i18n/ko";
import { LANGUAGE_IDS, type LanguageId } from "../../src/core/language";

/**
 * 언어 폴더를 통째로 훑는다. 새 언어를 더하면 검사 대상이 저절로 늘어난다 — 목록을 손으로 적으면
 * 번역을 넣은 사람이 그 목록을 빠뜨린다.
 */
const CATALOGS = import.meta.glob("../../src/i18n/*/index.ts", { import: "default", eager: true }) as Record<string, Record<string, string>>;

/** 경로에서 언어 코드를 읽는다. `../../src/i18n/ja/index.ts` → `ja` */
const languageOf = (path: string): LanguageId => path.split("/").at(-2) as LanguageId;

const ids = Object.keys(GLOSSARY) as GlossaryId[];

describe("용어 사전", () => {
  it("은 모든 용어에 뜻풀이를 둔다", () => {
    // 낱말만 보고 옮기면 틀리는 말이 많다 — 발굴은 뽑기가 아니라 방치형 자원 수집이다.
    for (const id of ids) {
      expect(GLOSSARY[id].note, id).toBeTruthy();
      expect(GLOSSARY[id].note.length, id).toBeGreaterThan(8);
    }
  });

  it("은 같은 한국어를 두 용어에 두지 않는다", () => {
    // 같은 낱말이 두 항목에 있으면 검사가 어느 쪽 표기를 요구하는지 갈린다.
    const forms = ids.map((id) => GLOSSARY[id].forms.ko);
    expect(new Set(forms).size).toBe(forms.length);
  });

  it("의 언어 코드는 지원 목록 안에 있다", () => {
    for (const id of ids) {
      for (const code of Object.keys(GLOSSARY[id].forms)) expect(LANGUAGE_IDS, `${id}.${code}`).toContain(code);
    }
  });

  it("은 한 언어를 정하면 그 언어의 모든 용어를 함께 정한다", () => {
    // 절반만 정해 두면 나머지는 번역하는 사람이 그때그때 새로 짓는다 — 사전을 둔 이유가 사라진다.
    const partial = LANGUAGE_IDS.filter((language) => {
      const filled = ids.filter((id) => glossaryForm(id, language) !== undefined).length;
      return filled > 0 && filled < ids.length;
    });
    expect(partial).toEqual([]);
  });
});

describe("번역 표의 용어", () => {
  it("는 사전이 정한 표기를 그대로 쓴다", () => {
    // 같은 말이 화면마다 다르게 번역되면 플레이어는 두 가지가 있는 줄 안다.
    const drifted: string[] = [];
    for (const [path, catalog] of Object.entries(CATALOGS)) {
      const language = languageOf(path);
      if (language === "ko") continue;
      for (const [key, translated] of Object.entries(catalog)) {
        const source = KO[key as keyof typeof KO];
        if (source === undefined) continue;
        for (const id of ids) {
          const korean = GLOSSARY[id].forms.ko;
          if (!source.includes(korean)) continue;
          if (GLOSSARY_EXCEPTIONS[key]?.includes(id)) continue;
          const expected = glossaryForm(id, language);
          if (expected === undefined) continue;
          if (!translated.includes(expected)) drifted.push(`${language} ${key}: ${korean} → ${expected} 없음 (${translated})`);
        }
      }
    }
    expect(drifted).toEqual([]);
  });
});
