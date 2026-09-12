/**
 * 지원 언어의 유일한 소유자.
 *
 * 언어 목록을 화면·저장 검증·글꼴이 저마다 적으면, 언어를 하나 늘릴 때 어느 한 곳이 빠진 채로
 * 남는다 — 설정에는 뜨는데 저장이 되돌리거나, 저장은 되는데 글자가 대체 글꼴로 뭉개진다.
 * 그래서 목록과 표기, 브라우저 언어 해석까지 이 파일 하나가 갖는다.
 *
 * Phaser를 import하지 않는다. 저장 검증(`core/settings.ts`)과 글꼴(`ui/fonts.ts`)이 같은 표를
 * 읽어야 하기 때문이다.
 */

/**
 * **저장이 받아들이는** 언어 코드 전체.
 *
 * 번역이 있는 언어보다 넓다. 나중에 언어를 여는 일이 목록 한 줄을 옮기는 것으로 끝나게 하려는
 * 것이며, 서버 저장이 붙은 뒤 새 클라이언트가 쓴 값을 옛 클라이언트가 모르는 값이라고 지우지
 * 않게 하려는 것이기도 하다. 지금 고를 수 있는 언어는 `SELECTABLE_LANGUAGE_IDS`다.
 *
 * 중국어는 `zh` 하나로 묶지 않는다 — 번체와 간체는 글자 모양이 다르고 글꼴도 다르므로, 한 코드로
 * 두면 어느 쪽 글꼴을 올릴지 고를 수 없다. BCP 47 표기를 그대로 쓴다.
 */
export const LANGUAGE_IDS = [
  "ko", "en", "ja", "zh-Hant", "zh-Hans", "th", "vi", "id", "es", "pt-BR", "de", "ru",
] as const;

export type LanguageId = typeof LANGUAGE_IDS[number];

/**
 * **지금 실제로 고를 수 있는** 언어.
 *
 * 번역 카탈로그가 있는 언어만 여기 선다. 목록에만 올리고 문구가 한국어로 남아 있으면, 고른 사람은
 * 제 언어를 골랐는데 화면이 그대로인 것을 보게 된다 — 눌러도 아무 일이 없는 조작을 세우지 않는
 * 화면 규칙과 같은 이유다.
 *
 * **번역이 들어오면 그 언어를 여기 더한다.** `LANGUAGE_IDS`는 이미 그 코드를 받아들이므로 저장
 * 마이그레이션은 필요 없다.
 */
export const SELECTABLE_LANGUAGE_IDS: ReadonlyArray<LanguageId> = ["ko", "en", "ja"];

/** 저장에 값이 없거나 알 수 없을 때 되돌아가는 언어다. */
export const DEFAULT_LANGUAGE: LanguageId = "ko";

/**
 * 설정 화면이 그대로 세우는 그 언어 자신의 이름.
 *
 * 언어 목록은 고르는 사람이 읽을 수 있어야 하므로 번역하지 않는다 — 일본어를 찾는 사람에게
 * "일본어"라고 적힌 줄은 지금 화면이 한국어일 때만 읽힌다.
 */
export const LANGUAGE_NATIVE_NAME: Record<LanguageId, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-Hant": "繁體中文",
  "zh-Hans": "简体中文",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  de: "Deutsch",
  ru: "Русский",
};

/** 저장·서버 값이 목록 밖이면 조용히 기본 언어로 되돌린다. */
export function normalizeLanguage(value: unknown): LanguageId {
  return LANGUAGE_IDS.includes(value as LanguageId) ? value as LanguageId : DEFAULT_LANGUAGE;
}

/**
 * 옛 저장에 남아 있을 수 있는 느슨한 표기를 현재 코드로 옮긴다.
 *
 * `zh`만 적힌 값은 어느 쪽인지 알 수 없으므로 간체로 본다 — 쓰는 사람이 더 많고, 설정에서 한 번
 * 고르면 그 뒤로는 명시된 코드가 저장된다.
 */
const LEGACY_ALIAS: Record<string, LanguageId> = {
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  "zh-hant": "zh-Hant",
  "zh-hans": "zh-Hans",
};

/**
 * BCP 47 표기 하나를 지원 코드로 옮긴다. 모르는 표기는 `undefined`다.
 *
 * 번역 여부를 보지 않는다 — 표기를 읽는 일과 그 언어를 지금 쓸 수 있는지는 다른 판단이라,
 * 한 함수에 섞으면 번역이 늘 때마다 표기 해석 규칙까지 다시 검증해야 한다.
 *
 * 완전 일치 → 별칭 → 지역을 뗀 앞 조각 순으로 좁힌다.
 */
export function resolveLanguageTag(tag: string): LanguageId | undefined {
  const lower = String(tag).trim().toLowerCase();
  if (!lower) return undefined;
  // 대소문자만 다른 정확한 표기(zh-hant → zh-Hant)를 먼저 받는다.
  const exact = LANGUAGE_IDS.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  if (LEGACY_ALIAS[lower]) return LEGACY_ALIAS[lower];
  // `ja-JP`, `en-US`처럼 지역만 붙은 표기는 앞 조각으로 다시 본다.
  const base = lower.split("-")[0];
  const byBase = LANGUAGE_IDS.find((id) => id.toLowerCase() === base);
  if (byBase) return byBase;
  return LEGACY_ALIAS[base];
}

/**
 * 브라우저가 말하는 선호 언어 목록에서 지금 쓸 수 있는 언어 하나를 고른다.
 *
 * 처음 실행에서만 쓴다. 한 번 고른 뒤로는 저장된 값이 언제나 우선한다 — 기기 언어를 바꿨다고
 * 플레이하던 언어가 말없이 바뀌면 안 된다.
 *
 * **번역이 있는 언어만 고른다.** 저장이 받아들이는 코드 전체에서 고르면, 독일어 기기가 아직
 * 번역하지 않은 독일어로 켜져 화면은 한국어인데 설정만 독일어라고 적히는 상태가 된다.
 */
export function matchLanguage(preferred: readonly string[]): LanguageId {
  for (const raw of preferred) {
    const resolved = resolveLanguageTag(raw);
    if (resolved !== undefined && SELECTABLE_LANGUAGE_IDS.includes(resolved)) return resolved;
  }
  return DEFAULT_LANGUAGE;
}
