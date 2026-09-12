/**
 * 정적 콘텐츠(`src/data`)의 문구를 언어별로 덮어쓰는 경계.
 *
 * ## 왜 화면 문구와 방식이 다른가
 *
 * 화면 문구는 키만 남기고 문장을 표로 옮겼다. 정적 콘텐츠는 그렇게 하지 않는다 — `relics.ts`는
 * 사람이 **읽으면서 고치는 콘텐츠 문서**다. 능력치 옆에 이름이 있고, 그 아래 관찰 기록이 있고,
 * 그 사이에 왜 이 수치인지를 적은 주석이 있다. 이름 자리에 `relic.anky.name`만 남으면 어느
 * 개체를 고치는 중인지 알 수 없고, 수치와 서사를 함께 보며 균형을 잡던 일이 불가능해진다.
 *
 * 그래서 **한국어는 데이터 파일에 그대로 두고**, 다른 언어만 개체 ID로 덮어쓴다. 덮을 값이
 * 없으면 한국어가 그대로 나온다 — 번역이 늦은 개체가 빈칸이 되지 않는다.
 *
 * ## 키
 *
 * `<종류>.<ID>.<자리>` 꼴이며 ID는 데이터가 이미 가진 것을 그대로 쓴다(`relic.anky.name`).
 * 개체가 늘면 키도 저절로 늘어난다 — 표를 따로 관리하지 않는다.
 */

import { DEFAULT_LANGUAGE, type LanguageId } from "../core/language";
import { applyDataOverlay } from "./dataFields";

/** 언어별 덮어쓰기 표. 한국어는 데이터 파일 자신이라 여기 없다. */
export type DataOverlay = Readonly<Record<string, string>>;

/**
 * 번역이 있는 언어의 덮어쓰기 표를 **필요할 때** 내려받는다.
 *
 * **번역이 들어오면 여기 한 줄 더한다.** 화면 문구 표(`catalog.ts`)와 같은 규칙이다.
 */
const LOADERS: Partial<Record<LanguageId, () => Promise<{ default: DataOverlay }>>> = {
  ja: () => import("./ja/data"),
  en: () => import("./en/data"),
};

const loaded = new Map<LanguageId, DataOverlay>();
let active: LanguageId = DEFAULT_LANGUAGE;

/** 덮어쓰기 표를 가진 언어. 검사가 화면 문구 표와 어긋나지 않았는지 대조한다. */
export function languagesWithDataOverlay(): ReadonlyArray<LanguageId> {
  return Object.keys(LOADERS) as LanguageId[];
}

/** 그 언어의 덮어쓰기 표를 받아 둔다. 표가 없는 언어는 조용히 한국어로 남는다. */
export async function loadDataOverlay(language: LanguageId): Promise<void> {
  active = language;
  const load = LOADERS[language];
  if (load && !loaded.has(language)) {
    try {
      loaded.set(language, (await load()).default);
    } catch {
      // 받지 못한 언어는 한국어로 보인다. 빈 화면보다 낫다.
    }
  }
  // 표가 없는 언어로 바꿀 때도 불러야 한다 — 앞선 언어의 글이 정적 정의에 남아 있다.
  applyDataOverlay();
}

/** 지금 화면이 쓰는 언어. 표가 아직 없으면 데이터의 한국어가 그대로 선다. */
export function setDataLanguage(language: LanguageId): void {
  active = language;
  applyDataOverlay();
}

/**
 * 정적 콘텐츠의 한 조각을 고른다.
 *
 * `korean`은 데이터 파일이 들고 있는 원본이며, 덮을 값이 없을 때 그대로 돌아간다.
 */
export function dataText(key: string, korean: string): string {
  return loaded.get(active)?.[key] ?? korean;
}
