import type { RuneMainStatKey, RunePart } from "./runes";

/** 룬 상품에서 사는 쪽이 고른 값. 구매 요청의 `runeChoice`와 같은 모양이다. */
export interface RuneShopChoice { part: RunePart; mainKeys?: readonly [RuneMainStatKey, RuneMainStatKey] }

/**
 * 주 옵션 칩을 눌렀을 때의 선택 목록.
 *
 * 둘까지만 고르고, 이미 고른 것을 누르면 풀리며, 둘이 찬 채 셋째를 누르면 **먼저 고른 것**이 밀려난다 —
 * 둘을 풀고 다시 고르게 하면 한 번 바꿀 때 손이 세 번 든다.
 */
export function toggleMainKey(selected: readonly RuneMainStatKey[], key: RuneMainStatKey): RuneMainStatKey[] {
  if (selected.includes(key)) return selected.filter((candidate) => candidate !== key);
  return [...selected, key].slice(-2);
}

/** 선택이 끝났으면 요청에 실을 값, 모자라면 `null`(구매 버튼이 꺼진다). 서버가 같은 규칙으로 다시 검증한다. */
export function runeShopChoice(kind: "part" | "partMain", part: RunePart | null, mains: readonly RuneMainStatKey[]): RuneShopChoice | null {
  if (part === null) return null;
  if (kind === "part") return { part };
  return mains.length === 2 ? { part, mainKeys: [mains[0]!, mains[1]!] } : null;
}
