/**
 * 두 값이 JSON으로 같은 모양인지 — **키 순서를 보지 않는다.**
 *
 * 저장 검증은 "정규화한 값이 원본과 같은가"로 모양을 확인하는데, 서버 저장(Postgres `jsonb`)은 객체 키를
 * 길이·사전순으로 다시 늘어놓아 돌려준다. 그대로 `JSON.stringify`끼리 비교하면 정규화가 키를 다른 순서로
 * 세우는 순간 멀쩡한 저장이 `corrupt_state`로 거부된다(v0.424.0 상황 특가가 그랬다 — 계정에 들어가지 못했다).
 * 그래서 객체 키를 정렬해 직렬화한 뒤 비교한다. `undefined` 처리는 `JSON.stringify`와 같다.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) sorted[key] = (item as Record<string, unknown>)[key];
    return sorted;
  }) ?? "undefined";
}

export function sameJsonShape(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
