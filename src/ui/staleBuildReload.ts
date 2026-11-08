import { isStaleChunkError, shouldReloadForStaleChunk } from "../core/staleBuild";

const KEY = "forgarden.staleReloadAt";

/** 옛 배포의 조각을 부르다 실패하면 한 번 새로 고친다(`core/staleBuild.ts`). 저장은 서버·로컬에 이미 있어 잃는 진행이 없다. */
export function installStaleBuildReload(): void {
  if (typeof window === "undefined") return;
  const reload = (): boolean => {
    let last: number | undefined;
    try { const raw = window.sessionStorage.getItem(KEY); last = raw === null ? undefined : Number(raw); } catch { last = undefined; }
    const now = Date.now();
    if (!shouldReloadForStaleChunk(last, now)) return false;
    try { window.sessionStorage.setItem(KEY, String(now)); } catch { return false; }
    window.location.reload();
    return true;
  };
  // Vite의 동적 import 사전 읽기가 실패하면 이 사건이 먼저 온다 — 새로 고치면 오류로 새지 않게 막는다.
  window.addEventListener("vite:preloadError", (event) => { if (reload()) event.preventDefault(); });
  window.addEventListener("unhandledrejection", (event) => { if (isStaleChunkError(event.reason)) reload(); });
}
