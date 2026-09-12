/**
 * 게임 글꼴의 유일한 소유자.
 *
 * 굵기를 화면마다 눈대중으로 고르면 같은 위계의 글이 화면마다 다른 무게로 보인다.
 * 그래서 굵기 값 자체는 여기서만 정하고, 바깥에서는 "이 글이 무슨 역할인가"만 고른다.
 * 실제 파일 이름·가중치·로딩은 전부 이 파일에 갇혀 있어야 한다.
 *
 * **언어가 늘어도 화면은 글꼴을 고르지 않는다.** 어느 언어가 어느 가족을 쓰는지는 아래 표
 * 하나가 갖고, 씬은 여전히 역할만 고른다.
 */

import { DEFAULT_LANGUAGE, LANGUAGE_IDS, type LanguageId } from "../core/language";

/**
 * 글의 역할. 크기가 아니라 위계로 고른다.
 *
 * - `display`: 화면 제목, 캐릭터·스테이지 이름, 결과 문구, 전투 피해 수치처럼 한눈에 읽혀야
 *   하는 짧은 강조 문구.
 * - `emphasis`: 설명 안에서 튀어야 하는 라벨·소제목·수치·태그. 제목만큼 세지는 않다.
 * - `body`: 스킬 설명, 대사, 안내, 통계 나열처럼 문장으로 읽는 모든 글. 글이 길면 언제나 이쪽이다.
 */
export type TextRole = "display" | "emphasis" | "body";

/** 캔버스와 CSS가 같은 이름을 쓰도록 한 곳에서만 정한다. */
export const FONT_FAMILY_NAME = "NEXON Kart";

/**
 * 게임 글꼴이 아직 안 왔거나 글립이 없을 때 쓰는 대체 순서.
 * 한글이 얇게 빠지지 않도록 굵은 산세리프만 둔다.
 */
export const FONT_FALLBACK = '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/** 역할별 굵기. 세 값 외의 굵기는 쓰지 않는다 — 파일이 세 개뿐이라 나머지는 브라우저가 흉내 낸다. */
export const FONT_WEIGHT: Record<TextRole, number> = {
  display: 800,
  emphasis: 700,
  body: 500,
} as const;

/** 등록할 글꼴 한 벌. 가족 이름까지 들고 다녀야 언어별 가족을 같은 방법으로 올린다. */
export interface FontFaceSpec {
  family: string;
  weight: number;
  file: string;
}

/**
 * `public/fonts`에 실제로 있는 파일과 굵기의 대응.
 *
 * **이 셋은 언어와 무관하게 언제나 올라간다.** 숫자·영문·한글·태국 문자를 전부 여기서 그리므로,
 * 언어를 바꿔도 `LV.42`나 피해 수치는 같은 글꼴로 남는다 — 그 수치들은 어느 언어에서나 똑같이
 * 나오는 글자라 언어마다 모양이 달라지면 화면이 통째로 다른 게임처럼 보인다.
 */
export const FONT_FACES: ReadonlyArray<FontFaceSpec> = [
  { family: FONT_FAMILY_NAME, weight: FONT_WEIGHT.body, file: "/fonts/NexonKart-Medium.woff2" },
  { family: FONT_FAMILY_NAME, weight: FONT_WEIGHT.emphasis, file: "/fonts/NexonKart-Bold.woff2" },
  { family: FONT_FAMILY_NAME, weight: FONT_WEIGHT.display, file: "/fonts/NexonKart-ExtraBold.woff2" },
];

/**
 * 언어마다 더 얹는 글꼴.
 *
 * `after`는 NEXON Kart 뒤에 서서 **NEXON Kart에 없는 글자만** 그린다 — 한자·가나는 라틴과 한
 * 낱말 안에서 섞이지 않으므로, 숫자와 영문을 공용으로 두고 CJK만 넘기면 된다.
 *
 * `before`는 앞에 선다. 베트남어가 그렇다 — NEXON Kart에 성조 글자(`ế`·`ộ`)가 없어서 뒤에 두면
 * 한 낱말 안에서 글자마다 글꼴이 갈린다(`Ti` + `ế` + `ng`). 낱말이 깨지는 쪽이 숫자가 갈리는
 * 쪽보다 훨씬 나쁘다.
 *
 * 값을 손으로 적지 않는다 — 파일 이름은 `scripts/prepare_fonts.py`가 굽는 규칙과 같아야 한다.
 */
export interface ScriptFont {
  family: string;
  /** NEXON Kart 앞에 설지 뒤에 설지. 한 낱말 안에서 글자가 섞이는 문자만 `before`다. */
  order: "before" | "after";
  /** 파일 이름의 머리말. `<slug>-<굵기>.woff2`로 굳는다. */
  slug: string;
}

/**
 * 언어 → 보조 글꼴. 없는 언어는 NEXON Kart만으로 충분하다는 뜻이다.
 *
 * 원본과 라이선스는 `scripts/prepare_fonts.py`의 표에 있고, 서브셋본은 예약 폰트 이름을 피하려고
 * 이름을 바꿔 굽는다(LINE Seed TW·Source Han Sans가 이름을 예약하고 있다).
 */
export const SCRIPT_FONTS: Partial<Record<LanguageId, ScriptFont>> = {
  ja: { family: "FG Sans JP", order: "after", slug: "fg-jp" },
  "zh-Hant": { family: "FG Sans TC", order: "after", slug: "fg-tc" },
  "zh-Hans": { family: "FG Sans SC", order: "after", slug: "fg-sc" },
  vi: { family: "FG Sans VI", order: "before", slug: "fg-vi" },
};

/** 그 언어가 더 올려야 하는 글꼴 목록. 세 굵기를 같은 규칙으로 만든다. */
export function scriptFontFaces(language: LanguageId): ReadonlyArray<FontFaceSpec> {
  const script = SCRIPT_FONTS[language];
  if (!script) return [];
  return (Object.keys(FONT_WEIGHT) as TextRole[]).map((role) => ({
    family: script.family,
    weight: FONT_WEIGHT[role],
    file: `/fonts/${script.slug}-${FONT_WEIGHT[role]}.woff2`,
  }));
}

/** 그 언어가 캔버스와 CSS에 넘길 글꼴 스택. */
export function fontFamilyFor(language: LanguageId): string {
  const script = SCRIPT_FONTS[language];
  const base = `"${FONT_FAMILY_NAME}"`;
  if (!script) return `${base}, ${FONT_FALLBACK}`;
  const extra = `"${script.family}"`;
  return script.order === "before" ? `${extra}, ${base}, ${FONT_FALLBACK}` : `${base}, ${extra}, ${FONT_FALLBACK}`;
}

let activeLanguage: LanguageId = DEFAULT_LANGUAGE;

/**
 * 지금 화면이 쓰는 언어를 정한다.
 *
 * 씬이 아니라 부트와 설정 저장 경계만 부른다. Phaser Text는 그린 순간의 글꼴로 텍스처를 굳히므로,
 * 바꾼 뒤에는 이미 그린 글자를 다시 굳혀야 한다(타이틀의 `refreshTextTextures`와 같은 이유다).
 */
export function setFontLanguage(language: LanguageId): void {
  activeLanguage = language;
}

/** 지금 언어의 글꼴 스택. `textStyle`이 매번 여기서 읽는다. */
export function activeFontFamily(): string {
  return fontFamilyFor(activeLanguage);
}

/** 역할을 캔버스가 이해하는 굵기 문자열로 바꾼다. Phaser의 `fontStyle`에 그대로 넣는다. */
export function fontStyleFor(role: TextRole): string {
  return `${FONT_WEIGHT[role]}`;
}

const loading = new Map<LanguageId, Promise<void>>();

async function addFace(face: FontFaceSpec): Promise<void> {
  try {
    const loaded = await new FontFace(face.family, `url(${face.file}) format("woff2")`, { weight: `${face.weight}` }).load();
    document.fonts.add(loaded);
  } catch {
    // 굵기 하나가, 또는 아직 굽지 않은 언어 글꼴이 실패해도 나머지는 살린다.
  }
}

/**
 * 공용 세 굵기와 그 언어의 보조 글꼴을 내려받는다.
 *
 * Phaser Text는 캔버스에 한 번 그린 뒤 텍스처로 굳히기 때문에, 글꼴이 늦게 도착하면 이미 그려진
 * 글자가 대체 글꼴 상태로 남는다. 그래서 첫 화면을 띄우기 전 부트에서 한 번만 기다린다.
 * 실패는 삼키고 대체 글꼴로 계속 진행한다 — 글꼴 하나 때문에 게임이 멈추지는 않는다.
 */
export function loadGameFonts(language: LanguageId = DEFAULT_LANGUAGE): Promise<void> {
  // 캐시 검사보다 먼저 정한다 — 뒤에 두면 같은 언어로 두 번째 돌아왔을 때 캐시가 일찍 반환해
  // 활성 언어가 옛 값으로 남는다.
  setFontLanguage(language);
  const cached = loading.get(language);
  if (cached) return cached;
  if (typeof document === "undefined" || !document.fonts) {
    const done = Promise.resolve();
    loading.set(language, done);
    return done;
  }
  const job = Promise.all([...FONT_FACES, ...scriptFontFaces(language)].map(addFace)).then(() => undefined);
  loading.set(language, job);
  return job;
}

/** 굽는 스크립트와 테스트가 같은 목록을 읽도록 모든 언어의 보조 글꼴을 한 번에 펼친다. */
export function allScriptFontFaces(): ReadonlyArray<FontFaceSpec> {
  return LANGUAGE_IDS.flatMap((language) => scriptFontFaces(language));
}
