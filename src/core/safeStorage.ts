/**
 * 브라우저 저장소를 안전하게 집는 유일한 문. 쿠키·사이트 데이터를 막았거나 일부 앱 내장 브라우저에서는
 * `localStorage`에 **접근하는 것만으로** `SecurityError`가 던져진다. 기본 인자나 모듈 최상단에서 그 값을
 * 읽던 때는 이 예외가 모듈을 읽는 순간 터져 게임이 흰 화면으로 시작도 못 했다 — 저장소가 없으면
 * 저장 없이도 한 판은 돌아야 하므로 `undefined`로 수렴시킨다.
 */
export function defaultLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
