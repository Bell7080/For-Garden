/**
 * 화면 문구의 유일한 조회 경계.
 *
 * 씬이 문장을 직접 들고 있으면 언어를 늘릴 때마다 그 문장을 찾아다녀야 한다. 화면은 **무슨
 * 문구인가**(키)만 고르고, 실제 글자는 이 경계가 고른다.
 *
 * Phaser를 import하지 않는다 — 순수 규칙과 테스트가 같은 표를 읽어야 하기 때문이다.
 */

import { DEFAULT_LANGUAGE, type LanguageId } from "../core/language";
import { KO, type TextKey } from "./ko";

export type { TextKey };

/** 번역 표. 빠진 키는 한국어가 메우므로 부분만 있어도 된다. */
export type Catalog = Partial<Record<TextKey, string>>;

/**
 * 언어별 표를 **필요할 때** 내려받는 목록.
 *
 * 모든 언어를 묶음에 넣으면 한국어만 쓰는 사람도 열한 언어를 함께 내려받는다 — 글꼴을 언어별로
 * 가른 것과 같은 이유다. 한국어는 대체본이라 여기 없고 언제나 묶음에 들어 있다.
 *
 * **번역이 들어오면 여기 한 줄, `SELECTABLE_LANGUAGE_IDS`에 한 줄을 더한다.**
 */
const LOADERS: Partial<Record<LanguageId, () => Promise<{ default: Catalog }>>> = {
  ja: () => import("./ja"),
  en: () => import("./en"),
};

/** 지금까지 받아 둔 표. 한국어는 대체본이라 처음부터 들어 있다. */
const loaded = new Map<LanguageId, Catalog>([[DEFAULT_LANGUAGE, KO]]);

let active: LanguageId = DEFAULT_LANGUAGE;

/** 번역 표를 가진 언어. 저장 검증과 설정 화면의 계약이 어긋나지 않았는지 테스트가 대조한다. */
export function languagesWithCatalog(): ReadonlyArray<LanguageId> {
  return [DEFAULT_LANGUAGE, ...Object.keys(LOADERS) as LanguageId[]];
}

/**
 * 그 언어의 표를 받아 둔다.
 *
 * 표가 없는 언어는 조용히 한국어로 남는다 — 문구 하나 때문에 게임이 멈추지는 않는다.
 * 글꼴과 같은 단계에서 부르므로, 화면이 첫 글자를 그리기 전에 끝나 있다.
 */
export async function loadTextCatalog(language: LanguageId): Promise<void> {
  active = language;
  if (loaded.has(language)) return;
  const load = LOADERS[language];
  if (!load) return;
  try {
    loaded.set(language, (await load()).default);
  } catch {
    // 받지 못한 언어는 한국어로 보인다. 빈 화면보다 낫다.
  }
}

/** 지금 화면이 쓰는 언어. 표가 아직 없으면 한국어가 그대로 선다. */
export function setTextLanguage(language: LanguageId): void {
  active = language;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * 문구 하나를 고른다.
 *
 * `{이름}` 자리는 `params`가 채운다. 채울 값이 없으면 자리 표시를 그대로 남긴다 — 조용히 비우면
 * "파편 개를 지급했습니다"처럼 뜻이 빠진 문장이 화면에 선다. 값으로 `undefined`를 넘긴 자리도
 * 같다: 데이터에 없는 수치가 `undefined`라는 글자로 화면에 서지 않게 한다.
 */
export function t(key: TextKey, params?: Readonly<Record<string, string | number | undefined>>): string {
  const text = loaded.get(active)?.[key] ?? KO[key];
  if (!params) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
