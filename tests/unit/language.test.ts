import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE, LANGUAGE_IDS, LANGUAGE_NATIVE_NAME, matchLanguage, normalizeLanguage,
} from "../../src/core/language";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";

describe("지원 언어 목록", () => {
  it("은 중국어를 번체와 간체로 갈라 둔다", () => {
    // 한 코드로 두면 어느 글꼴을 올릴지 고를 수 없다.
    expect(LANGUAGE_IDS).toContain("zh-Hant");
    expect(LANGUAGE_IDS).toContain("zh-Hans");
    expect(LANGUAGE_IDS).not.toContain("zh");
  });

  it("은 모든 언어가 제 이름을 그 언어로 갖는다", () => {
    for (const id of LANGUAGE_IDS) {
      expect(LANGUAGE_NATIVE_NAME[id]).toBeTruthy();
      // 목록은 고르는 사람이 읽어야 하므로 코드나 영어 이름으로 대신하지 않는다.
      expect(LANGUAGE_NATIVE_NAME[id]).not.toBe(id);
    }
    expect(new Set(Object.values(LANGUAGE_NATIVE_NAME)).size).toBe(LANGUAGE_IDS.length);
  });

  it("의 기본 언어는 목록 안에 있다", () => {
    expect(LANGUAGE_IDS).toContain(DEFAULT_LANGUAGE);
  });
});

describe("언어 정규화", () => {
  it("은 알 수 없는 값을 기본 언어로 되돌린다", () => {
    for (const bad of [undefined, null, "", "kr", "jp", "zh", 3, {}]) expect(normalizeLanguage(bad)).toBe(DEFAULT_LANGUAGE);
  });

  it("은 지원 언어를 그대로 남긴다", () => {
    for (const id of LANGUAGE_IDS) expect(normalizeLanguage(id)).toBe(id);
  });
});

describe("기기 언어 해석", () => {
  it("은 지역이 붙은 표기에서 언어를 읽는다", () => {
    expect(matchLanguage(["ja-JP"])).toBe("ja");
    expect(matchLanguage(["en-US", "ko"])).toBe("en");
    expect(matchLanguage(["vi-VN"])).toBe("vi");
    expect(matchLanguage(["th-TH"])).toBe("th");
  });

  it("은 중국어 지역 표기를 번체와 간체로 가른다", () => {
    expect(matchLanguage(["zh-TW"])).toBe("zh-Hant");
    expect(matchLanguage(["zh-HK"])).toBe("zh-Hant");
    expect(matchLanguage(["zh-CN"])).toBe("zh-Hans");
    expect(matchLanguage(["zh-Hant"])).toBe("zh-Hant");
    // 어느 쪽인지 말하지 않은 zh는 쓰는 사람이 더 많은 간체로 본다.
    expect(matchLanguage(["zh"])).toBe("zh-Hans");
  });

  it("은 앞선 선호를 먼저 고르고 모르면 기본 언어로 간다", () => {
    expect(matchLanguage(["xx", "ja", "ko"])).toBe("ja");
    expect(matchLanguage(["xx", "yy"])).toBe(DEFAULT_LANGUAGE);
    expect(matchLanguage([])).toBe(DEFAULT_LANGUAGE);
    expect(matchLanguage([""])).toBe(DEFAULT_LANGUAGE);
  });
});

describe("설정 저장", () => {
  it("은 새 계정에 기본 언어를 넣는다", () => {
    expect(createDefaultSettings().game.language).toBe(DEFAULT_LANGUAGE);
  });

  it("은 새로 늘어난 언어를 저장에서 되돌려 준다", () => {
    // 옛 저장은 ko·en·ja만 가질 수 있었다. 늘어난 코드가 정규화에서 떨어지면 고른 언어가 사라진다.
    for (const id of LANGUAGE_IDS) {
      expect(normalizeSettings({ game: { language: id } }).game.language).toBe(id);
    }
  });

  it("은 손상된 언어 값을 기본 언어로 복구한다", () => {
    expect(normalizeSettings({ game: { language: "kr" } }).game.language).toBe(DEFAULT_LANGUAGE);
    expect(normalizeSettings({}).game.language).toBe(DEFAULT_LANGUAGE);
  });
});
