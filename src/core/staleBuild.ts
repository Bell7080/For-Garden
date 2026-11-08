/**
 * 배포가 바뀐 뒤 옛 화면이 사라진 조각 파일을 부를 때를 알아본다.
 *
 * 새 배포가 올라가면 옛 `assets/index-해시.js` 조각은 서버에 없고, 그 주소는 앱 껍데기(`index.html`)로 떨어져
 * 「'text/html' is not a valid JavaScript MIME type」이 난다(오류 보고). 화면을 열어 둔 채 배포를 맞은 사람은
 * 그 뒤로 Puppet·연출 같은 늦게 읽는 조각이 하나도 서지 않는다. 그런 오류면 한 번만 새로 고쳐 새 배포를 받는다 —
 * 새로 고친 뒤에도 같은 일이 나면(진짜로 파일이 없는 배포) 되풀이하지 않게 시각으로 막는다.
 */
const STALE_CHUNK_PATTERNS = [
  /is not a valid JavaScript MIME type/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

/** 새로 고친 뒤 이 시간 안에 다시 나면 새로 고치지 않는다. */
export const STALE_RELOAD_GAP_MS = 60_000;

export function isStaleChunkError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message));
}

/** 지난번 새로 고친 시각(없으면 undefined)에서 지금 새로 고쳐도 되는지. */
export function shouldReloadForStaleChunk(lastReloadAt: number | undefined, now: number): boolean {
  return lastReloadAt === undefined || !Number.isFinite(lastReloadAt) || now - lastReloadAt >= STALE_RELOAD_GAP_MS;
}
