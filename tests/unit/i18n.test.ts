import { describe, expect, it } from "vitest";
import { KO } from "../../src/i18n/ko";
import { languagesWithCatalog, t } from "../../src/i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_IDS, SELECTABLE_LANGUAGE_IDS } from "../../src/core/language";

/** 화면 코드에서 한글 문자열을 찾기 위한 원본. 표 자신은 검사에서 뺀다. */
const SOURCES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/**
 * 언어 폴더를 통째로 훑는다. 새 언어를 더하면 검사 대상이 저절로 늘어난다 — 목록을 손으로 적으면
 * 번역을 넣은 사람이 그 목록을 빠뜨린다.
 */
const CATALOGS = import.meta.glob("../../src/i18n/*/index.ts", { import: "default", eager: true }) as Record<string, Record<string, string>>;

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("문구 표", () => {
  it("은 빈 값을 두지 않는다", () => {
    for (const [key, value] of Object.entries(KO)) {
      expect(value, key).toBeTruthy();
      expect(value.trim(), key).toBe(value.trim());
    }
  });

  it("의 키는 화면 이름으로 시작한다", () => {
    // 키가 어느 화면 것인지 읽히지 않으면 표가 커질 때 같은 문구가 두 번 생긴다.
    // 뒷자리에 `_`를 허용하는 것은 계약 ID를 그대로 이어 붙여 부르는 키 때문이다
    // (`product.action.${acquisition.kind}` → `platform_payment`). 그 ID를 화면용으로 다시
    // 지으면 갈래가 늘 때 한쪽만 고치게 된다.
    for (const key of Object.keys(KO)) expect(key, key).toMatch(/^[a-z][A-Za-z]*\.[A-Za-z0-9._]+$/);
  });

  it("은 아무도 부르지 않는 키를 남기지 않는다", () => {
    // 쓰지 않는 키는 번역할 때마다 비용만 늘리고, 화면을 고친 흔적을 지운다.
    // 같은 한국어가 두 키에 있는 것은 막지 않는다 — 탭 이름과 섹션 제목처럼 다른 언어에서
    // 길이를 달리 잡아야 하는 자리가 있다.
    const code = Object.entries(SOURCES)
      .filter(([path]) => !path.startsWith("../../src/i18n/"))
      .map(([, text]) => text)
      .join("\n");
    // 키를 `\`skill.target.${targeting}\``처럼 조립해 부르는 자리도 쓰는 것으로 본다 — 분기마다
    // 키를 손으로 늘어놓게 하면 갈래가 늘 때 그중 하나를 빠뜨린다.
    const prefixes = [...code.matchAll(/`([a-z][\w.]*)\.\$\{/g)].map((match) => `${match[1]}.`);
    const unused = Object.keys(KO)
      .filter((key) => !code.includes(`"${key}"`))
      .filter((key) => !prefixes.some((prefix) => key.startsWith(prefix)));
    expect(unused).toEqual([]);
  });
});

describe("자리 표시", () => {
  it("는 채울 값을 넣으면 바뀐다", () => {
    expect(t("settings.debug.grantedRelics", { count: 3 })).toContain("3");
    expect(t("settings.debug.grantedRelics", { count: 3 })).not.toContain("{count}");
  });

  it("는 채울 값이 없으면 자리를 그대로 남긴다", () => {
    // 조용히 비우면 "새 캐릭터 명을 보유 처리했습니다"처럼 뜻이 빠진 문장이 화면에 선다.
    expect(t("settings.debug.grantedRelics")).toContain("{count}");
    expect(t("settings.debug.grantedRelics", {})).toContain("{count}");
  });

  it("가 없는 문구는 그대로 돌려준다", () => {
    expect(t("settings.title")).toBe(KO["settings.title"]);
  });
});

describe("번역 표", () => {
  it("은 한국어에 없는 키를 만들지 않는다", () => {
    // 한국어 표가 원본이라, 여기 없는 키는 화면이 부르지 않으므로 영영 보이지 않는다.
    for (const [path, catalog] of Object.entries(CATALOGS)) {
      const unknown = Object.keys(catalog).filter((key) => !(key in KO));
      expect(unknown, path).toEqual([]);
    }
  });

  it("은 한국어와 같은 자리 표시를 쓴다", () => {
    // 번역이 자리를 새로 만들면 그 값은 영영 채워지지 않고, 자리를 빠뜨리면 수치가 사라진다.
    for (const [path, catalog] of Object.entries(CATALOGS)) {
      for (const [key, value] of Object.entries(catalog)) {
        const expected = placeholders(KO[key as keyof typeof KO]);
        expect(placeholders(value), `${path} ${key}`).toEqual(expected);
      }
    }
  });
});

describe("언어와 표의 계약", () => {
  it("은 고를 수 있는 언어가 모두 표를 갖는다", () => {
    // 표 없는 언어를 고르면 화면이 통째로 한국어로 남는다.
    for (const id of SELECTABLE_LANGUAGE_IDS) expect(languagesWithCatalog()).toContain(id);
  });

  it("은 표를 가진 언어가 저장이 받아들이는 목록 안에 있다", () => {
    for (const id of languagesWithCatalog()) expect(LANGUAGE_IDS).toContain(id);
  });

  it("의 기본 언어는 언제나 표를 갖는다", () => {
    // 기본 언어의 표가 대체본이라, 이것이 없으면 빠진 키를 메울 자리가 없다.
    expect(languagesWithCatalog()).toContain(DEFAULT_LANGUAGE);
  });
});

/**
 * 한글을 그대로 두어도 되는 자리. **목록에 없는 파일은 전부 검사한다.**
 *
 * 예전에는 반대였다 — 이관을 마친 파일만 목록에 올렸고, 그래서 목록에 올리는 것을 잊은 125개
 * 파일은 한글이 다시 박혀도 아무도 몰랐다. 지금은 새 파일이 저절로 검사에 들어오고, 빼려면
 * **왜 빼는지**를 여기 적어야 한다.
 */
const KOREAN_ALLOWED: Readonly<Record<string, string>> = {
  // 그 언어 자신의 표기다. 번역하면 제 언어를 찾을 수 없다.
  "../../src/core/language.ts": "언어 이름은 그 언어로 적는다",
  // ZIP 안의 실제 관절 키라 옮기면 찾지 못한다.
  "../../src/puppets/anchors.ts": "Puppet 관절 이름",
  // 화면에 그리지 않는다. E2E가 어느 단계인지 확인하는 데만 쓴다.
  "../../src/scenes/loadingSteps.ts": "로딩 단계 이름",
  // 화면에 그리는 곳이 없다. 테스트와 개발자만 읽는다.
  "../../src/core/skirmish.ts": "전투 기록(log)",
  // 던져서 복구 경로를 고르는 진단문이다. 그대로 그리지 않는다.
  "../../src/state/SaveManager.ts": "저장 검증 오류와 v12 옛 룬 이름",
  "../../src/core/expeditionMap.ts": "모듈을 읽을 때 터지는 지도 검증",
  "../../src/puppets/IndexedPuppetCreature.ts": "개발자 오류",
  // 실제 이용자 풀이 생기면 서버가 주는 이름이 그대로 선다.
  "../../src/ui/expeditionRankingLayout.ts": "표본 순위의 계정 이름",
  // 한국어가 원본이고 다른 언어만 덮어쓴다(정적 콘텐츠와 같은 경계).
  "../../src/core/missions.ts": "임무 제목 — registerDataText로 덮는다",
};

/**
 * 사람이 읽지 않는 줄은 검사에서 뺀다.
 *
 * `console.*`는 개발자만 보는 기록이고, `setDebug*`가 넘기는 화면 이름은 화면에 그리지 않고
 * E2E가 어느 화면인지 확인하는 데만 쓴다 — 언어를 따라 바뀌면 그 확인이 언어마다 갈린다.
 */
const isDeveloperLine = (line: string): boolean => /console\.|setDebug|throw new \w*Error/.test(line);

/**
 * 모듈을 읽는 순간 굳는 문구가 있는가.
 *
 * `const X = { a: t("...") }`처럼 **선언의 초기값**에서 문구를 고르면 그 값은 모듈을 읽는 순간
 * 한 번 굳는다 — 문구 표는 타이틀 로딩에서야 도착하므로 그 자리만 한국어로 남고, 언어를 바꿔도
 * 따라오지 않는다. 일본어로 바꾼 화면에서 하단 탭 다섯과 능력치 판의 `射程 · 중거리`가 그랬다.
 * 부를 때 고르는 **함수**로 두면 그 일이 없다.
 */
describe("굳은 문구", () => {
  it("은 선언의 초기값에서 문구를 고르지 않는다", () => {
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(SOURCES)) {
      if (path.startsWith("../../src/i18n/")) continue;
      const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      let depth = 0;
      let frozen = false;
      for (const [index, line] of withoutComments.split("\n").entries()) {
        // 바깥 층에서 시작하는 `const`·`let` 선언은 그 초기값이 곧 모듈을 읽을 때의 값이다.
        // 화살표 함수와 `function`은 부를 때 몸통이 도므로 굳지 않는다.
        if (depth === 0 && /^\s*(export\s+)?(const|let)\s/.test(line) && !/=>|function /.test(line)) frozen = true;
        if (frozen && /\bt\(/.test(line)) offenders.push(`${path}:${index + 1} ${line.trim().slice(0, 60)}`);
        depth += (line.match(/[{([]/g) ?? []).length - (line.match(/[})\]]/g) ?? []).length;
        if (depth < 0) depth = 0;
        if (frozen && (depth === 0 || /=>|function /.test(line))) frozen = false;
      }
    }
    expect(offenders).toEqual([]);
  });

  it("은 문구 키를 그대로 그리지 않는다", () => {
    // 표에 담아 둔 `TextKey`를 `t()` 없이 `add.text`에 넘기면 화면에 `inventory.tab.rune`이
    // 그대로 선다 — 어느 언어에서나 틀리지만, 낱말이 아니라 점 찍힌 키라 길이까지 달라져
    // 탭 밖으로 넘친다(가방의 카테고리 탭과 능력치 상세의 다섯 축이 그랬다).
    //
    // 그래서 **키를 담는 자리는 이름이 `...Key`로 끝난다.** 이미 번역된 문자열을 담는 `label`과
    // 이름으로 갈라 두면, 그리는 자리에서 `t()`가 빠진 것이 읽는 것만으로 보인다.
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(SOURCES)) {
      if (path.startsWith("../../src/i18n/")) continue;
      for (const [index, line] of code.split("\n").entries()) {
        const match = /\.text\(\s*[^,]+,\s*[^,]+,\s*([A-Za-z_$][\w$]*\.\w*Key)\s*,/.exec(line);
        if (match) offenders.push(`${path}:${index + 1} ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("은 문구 키를 담는 자리를 이름으로 갈라 둔다", () => {
    // `label: TextKey`는 이미 번역된 문자열을 담는 `label: string`과 이름이 같아, 그리는 자리에서
    // `t()`가 빠져도 눈에 띄지 않는다.
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(SOURCES)) {
      if (path.startsWith("../../src/i18n/")) continue;
      if (/\blabel\s*:\s*TextKey/.test(code)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});

describe("화면 문구", () => {
  it("은 화면에 한글을 남기지 않는다", () => {
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(SOURCES)) {
      // 문구 표와 정적 콘텐츠는 한국어가 원본이라 검사 대상이 아니다.
      if (path.startsWith("../../src/i18n/") || path.startsWith("../../src/data/")) continue;
      if (path in KOREAN_ALLOWED) continue;
      const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const [index, line] of withoutComments.split("\n").entries()) {
        if (isDeveloperLine(line)) continue;
        for (const match of line.matchAll(/"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
          const text = match[1] ?? match[2] ?? match[3];
          if (/[가-힣]/.test(text)) offenders.push(`${path}:${index + 1} ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("의 예외 목록은 실제로 있는 파일만 담는다", () => {
    // 파일이 사라졌는데 예외만 남으면, 그 이름으로 새 파일을 만든 사람이 조용히 검사를 면한다.
    for (const path of Object.keys(KOREAN_ALLOWED)) expect(SOURCES[path], path).toBeTruthy();
  });
});
