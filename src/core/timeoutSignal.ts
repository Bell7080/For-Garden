/**
 * 시한이 있는 `AbortSignal`. `AbortSignal.timeout`은 Safari 16·Chrome 103부터라, 그보다 오래된 기기에서는
 * 호출하는 순간 `TypeError`로 **모든 서버 요청이 시작도 못 하고** 실패했다 — 없으면 직접 만든다.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("The operation timed out.", "TimeoutError")), ms);
  return controller.signal;
}
