import { beforeEach, describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { dataText, loadDataOverlay, registeredDataTexts, languagesWithDataOverlay } from "../../src/i18n";
import { LANGUAGE_IDS } from "../../src/core/language";

/** 언어별 덮어쓰기 표를 통째로 훑는다. 새 언어를 더하면 검사 대상이 저절로 늘어난다. */
const OVERLAYS = import.meta.glob("../../src/i18n/*/data.ts", { import: "default", eager: true }) as Record<string, Record<string, string>>;

const languageOf = (path: string): string => path.split("/").at(-2) as string;

describe("정적 콘텐츠 번역", () => {
  beforeEach(async () => {
    // 한 편이 바꿔 둔 언어가 다음 편으로 새지 않게 한국어로 되돌린다.
    await loadDataOverlay("ko");
  });

  it("은 언어를 바꾸면 정적 정의의 문구가 함께 바뀐다", async () => {
    expect(getRelic("anky").name).toBe("토리카");
    await loadDataOverlay("ja");
    expect(getRelic("anky").name).toBe("トリカ");
    expect(getRelic("anky").origin).toBe("トリケラトプス");
  });

  it("은 한국어로 되돌리면 원본이 그대로 돌아온다", async () => {
    // 원본을 붙잡아 두지 않으면 두 번째 언어에 첫 번째 언어의 글이 남는다.
    await loadDataOverlay("ja");
    await loadDataOverlay("ko");
    expect(getRelic("anky").name).toBe("토리카");
    expect(getRelic("anky").origin).toBe("트리케라톱스");
  });

  it("은 덮을 값이 없는 자리를 한국어로 남긴다", async () => {
    await loadDataOverlay("ja");
    // 번역이 늦은 자리는 빈칸이 아니라 한국어가 서야 한다. 실제 표의 구멍에 기대지 않고
    // 없는 키로 직접 확인한다 — 표가 다 차면 그 구멍이 사라져 검사도 함께 사라진다.
    expect(dataText("relic.__nobody__.name", "토리카")).toBe("토리카");
  });
});

describe("덮어쓰기 표", () => {
  it("는 데이터에 없는 키를 만들지 않는다", () => {
    // 없는 키는 영영 쓰이지 않으므로 번역한 사람이 그 사실을 알아야 한다.
    const known = new Set(registeredDataTexts().map(({ key }) => key));
    for (const [path, overlay] of Object.entries(OVERLAYS)) {
      const unknown = Object.keys(overlay).filter((key) => !known.has(key));
      expect(unknown, path).toEqual([]);
    }
  });

  it("의 언어는 저장이 받아들이는 목록 안에 있다", () => {
    for (const path of Object.keys(OVERLAYS)) expect(LANGUAGE_IDS).toContain(languageOf(path));
    for (const id of languagesWithDataOverlay()) expect(LANGUAGE_IDS).toContain(id);
  });

  it("는 다 채운 언어에 구멍을 내지 않는다", () => {
    // 한 언어를 다 채우고 나면 그 뒤로는 **빠뜨린 자리가 곧 회귀**다 — 새 개체를 넣은 사람이
    // 그 언어만 한국어로 남기는 일을 막는다. 아직 채우는 중인 언어는 여기 오르지 않는다.
    const COMPLETE = ["en", "ja"];
    const known = registeredDataTexts().map(({ key }) => key);
    for (const [path, overlay] of Object.entries(OVERLAYS)) {
      if (!COMPLETE.includes(languageOf(path))) continue;
      const missing = known.filter((key) => !(key in overlay));
      expect(missing, path).toEqual([]);
    }
  });

  it("는 빈 값을 두지 않는다", () => {
    for (const [path, overlay] of Object.entries(OVERLAYS)) {
      for (const [key, value] of Object.entries(overlay)) expect(value, `${path} ${key}`).toBeTruthy();
    }
  });
});

/**
 * 정적 콘텐츠 파일 전부. 새 파일이 생기면 검사 대상이 저절로 늘어난다 — 목록을 손으로 적으면
 * 데이터를 추가한 사람이 그 목록을 빠뜨린다.
 */
const DATA_SOURCES = import.meta.glob("../../src/data/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** 등록은 모듈이 읽힐 때 일어난다 — 전부 읽어 두지 않으면 등록되지 않은 것처럼 보인다. */
import.meta.glob("../../src/data/**/*.ts", { eager: true });

/**
 * `src/data` 밖에서 같은 경계를 쓰는 표.
 *
 * 임무 목록은 운영 중 늘어나는 정적 콘텐츠지만 진행 규칙과 한 파일에 산다 — 덮어쓰기 키가
 * 등록된 것으로 보이려면 이 검사도 그 모듈을 읽어야 한다.
 */
import "../../src/core/missions";

/**
 * 화면에 뜨지 않아 등록하지 않는 자리. **비우려고 적지 않는다** — 왜 표시 문구가 아닌지를
 * 함께 남긴다. 파일 전체면 `"all"`, 몇 줄뿐이면 그 글만 적는다.
 */
const NOT_DISPLAYED: Readonly<Record<string, "all" | readonly string[]>> = {
  // 증강 수치의 검수 장부. 왜 이 수치인지를 적은 기획 근거이며 화면에 뜨지 않는다.
  "../../src/data/expeditionAugmentBalance.ts": "all",
  // 표본 친구의 계정 이름. 실제 이용자 풀이 생기면 서버가 주는 이름이 그대로 선다.
  "../../src/data/friends.ts": ["하늘정원", "이끼연구소"],
};

/** 소스에 적힌 이스케이프를 실제 문자열로 되돌린다 — 그러지 않으면 줄바꿈이 든 글이 어긋난다. */
const unescape = (text: string): string => text.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

describe("정적 콘텐츠의 등록 누락", () => {
  it("은 화면에 뜨는 한글을 등록하지 않은 채 남기지 않는다", () => {
    // 실제로 등록된 값과 대조한다 — 파일 단위로 보면 `products.ts`처럼 다른 파일이 등록해 주는
    // 경우를 놓친다.
    const registered = new Set(registeredDataTexts().map(({ korean }) => korean));
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(DATA_SOURCES)) {
      const allowed = NOT_DISPLAYED[path];
      if (allowed === "all") continue;
      const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const line of withoutComments.split("\n")) {
        // 던지는 오류와 등록 줄 자신은 개발자만 읽는다.
        if (/Error\(|registerDataText|registerDialogueTexts/.test(line)) continue;
        for (const match of line.matchAll(/"([^"\\\n]*(?:\\.[^"\\\n]*)*)"/g)) {
          const text = unescape(match[1]);
          if (!/[가-힣]/.test(text)) continue;
          if (registered.has(text) || allowed?.includes(text)) continue;
          offenders.push(`${path}: ${text.slice(0, 40)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
