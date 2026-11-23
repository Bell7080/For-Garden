import { WEBGL_RECOVERY, mayReloadAfterContextLoss, nextReloadHistory, parseReloadHistory } from "../core/webglRecovery";
import { noteBreadcrumb, reportError } from "../managers/ErrorReporter";

/**
 * WebGL 컨텍스트를 잃었는지 지켜보고, 돌아오지 않으면 페이지를 새로 띄운다(규칙은 `core/webglRecovery.ts`).
 *
 * 잃은 순간과 돌아오지 않은 순간을 모두 `client_errors`에 남긴다 — 이 사건은 예외가 아니라서 예전에는 아무 기록도
 * 남지 않았고, 「화면이 까맣고 소리만 난다」는 제보를 받고도 어느 기기·어느 화면·어느 GPU인지 알 길이 없었다.
 * 숨겨진 동안은 브라우저가 복구를 미루는 것이 정상이라 기다리는 시계를 보이는 동안만 돌린다.
 */
const RELOAD_HISTORY_KEY = "forgarden.webglReloads";

/** 복구 사건 뒤 렌더러가 다시 섰는지 볼 때까지 기다리는 시간. */
const RESTORE_CHECK_MS = 300;

/**
 * `renderer`는 Phaser 렌더러 — 복구 사건이 와도 Phaser가 자원을 되살리다 던지면(갤럭시 S24 Xclipse 940의
 * `Framebuffer Unsupported`, client_errors #51·#52) `contextLost`가 true로 남아 화면이 까맣게 굳는다. 그때도 새로 띄운다.
 */
export function installWebglWatchdog(canvas: HTMLCanvasElement, gl: WebGLRenderingContext | null, renderer?: { readonly contextLost?: boolean }): void {
  const gpu = describeGpu(gl);
  let lostAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = (): void => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const arm = (): void => {
    clear();
    if (lostAt === null || document.visibilityState === "hidden") return;
    timer = setTimeout(giveUp, WEBGL_RECOVERY.restoreWaitMs);
  };

  const reloadIfAllowed = (kind: string, message: string, since: number): void => {
    const history = readHistory();
    const now = Date.now();
    const reload = mayReloadAfterContextLoss(history, now);
    reportError(kind, new Error(message), { ...gpu, waitedMs: now - since, reload });
    if (!reload) return;
    writeHistory(nextReloadHistory(history, now));
    setTimeout(() => window.location.reload(), WEBGL_RECOVERY.reportGraceMs);
  };

  const giveUp = (): void => {
    timer = undefined;
    if (lostAt === null) return;
    reloadIfAllowed("webgl.restoreTimeout", "WebGL context not restored", lostAt);
  };

  canvas.addEventListener("webglcontextlost", () => {
    lostAt = Date.now();
    noteBreadcrumb("webgl:lost");
    reportError("webgl.contextLost", new Error("WebGL context lost"), { ...gpu, hidden: document.visibilityState === "hidden" });
    arm();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    const since = lostAt ?? Date.now();
    noteBreadcrumb(`webgl:restored+${Date.now() - since}ms`);
    lostAt = null;
    clear();
    if (!renderer) return;
    // Phaser의 복구 처리기가 먼저 돈다. 그 안에서 던졌으면 렌더러는 아직 잃은 상태로 남는다.
    setTimeout(() => {
      if (lostAt === null && renderer.contextLost === true) reloadIfAllowed("webgl.restoreFailed", "WebGL renderer failed to restore", since);
    }, RESTORE_CHECK_MS);
  });
  document.addEventListener("visibilitychange", arm);
}

/** 보고에 함께 실을 GPU 정보 — 어느 기기에서 잃는지가 원인을 가른다. */
function describeGpu(gl: WebGLRenderingContext | null): Record<string, unknown> {
  if (!gl) return {};
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 80),
      maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0,
      ua: navigator.userAgent.slice(0, 160),
    };
  } catch {
    return {};
  }
}

function readHistory(): number[] {
  try { return parseReloadHistory(window.sessionStorage.getItem(RELOAD_HISTORY_KEY)); } catch { return []; }
}

function writeHistory(history: number[]): void {
  try { window.sessionStorage.setItem(RELOAD_HISTORY_KEY, JSON.stringify(history)); } catch { /* 저장소가 막혀도 새로 띄우는 일은 한다 */ }
}
