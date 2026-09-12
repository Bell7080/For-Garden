/**
 * 정적 콘텐츠의 문구 필드를 언어에 맞춰 갈아 끼우는 등록기.
 *
 * ## 왜 호출부를 고치지 않는가
 *
 * `def.name`은 126곳에서 읽는다. 그 전부를 `relicName(def)`로 바꾸면 새 화면이 생길 때마다
 * 한 곳만 빠뜨려도 그 자리가 영영 한국어로 남는다 — **빠뜨린 것이 보이지 않는** 종류의 실수다.
 *
 * 대신 언어가 정해지는 순간 정적 정의의 **문구 필드만** 그 언어로 갈아 끼운다. 읽는 쪽은
 * 지금까지처럼 `def.name`을 읽으면 되고, 새 화면도 아무것도 하지 않아도 번역을 받는다.
 *
 * ## 되돌릴 수 있어야 한다
 *
 * 한국어 원본을 등록할 때 함께 붙잡아 둔다. 그러지 않으면 언어를 두 번 바꿀 때 이미 번역된
 * 값을 다시 번역하려 들어, 두 번째 언어에는 첫 번째 언어의 글이 남는다.
 *
 * ## 무엇을 등록하는가
 *
 * **화면에 보이는 글만** 등록한다. ID·에셋 키·수치는 언어와 무관하며, 번역하면 데이터를
 * 찾는 코드가 깨진다.
 */

import { dataText } from "./dataText";

interface Registered {
  /** 문구를 들고 있는 객체. 정적 정의라 모듈이 살아 있는 동안 같은 객체다. */
  readonly target: Record<string, unknown>;
  readonly field: string;
  readonly overlayKey: string;
  /** 데이터 파일이 들고 있던 원본. 언어를 바꿀 때마다 여기서 다시 시작한다. */
  readonly korean: string;
}

const registered: Registered[] = [];

/**
 * 문구 필드 하나를 등록한다. 값이 문자열이 아니거나 비어 있으면 조용히 넘어간다 —
 * 선택 필드를 가진 개체마다 조건을 적지 않아도 되게 하려는 것이다.
 */
export function registerDataText(target: unknown, field: string, overlayKey: string): void {
  if (!target || typeof target !== "object") return;
  const holder = target as Record<string, unknown>;
  const korean = holder[field];
  if (typeof korean !== "string" || korean.length === 0) return;
  registered.push({ target: holder, field, overlayKey, korean });
}

/** 등록한 문구를 지금 언어로 갈아 끼운다. 덮을 값이 없는 자리는 한국어로 돌아간다. */
export function applyDataOverlay(): void {
  for (const entry of registered) entry.target[entry.field] = dataText(entry.overlayKey, entry.korean);
}

/** 검사가 훑을 수 있도록 등록된 키와 원본을 그대로 내준다. */
export function registeredDataTexts(): ReadonlyArray<{ key: string; korean: string }> {
  return registered.map(({ overlayKey, korean }) => ({ key: overlayKey, korean }));
}
