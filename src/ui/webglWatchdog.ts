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

export function installWebglWatchdog(canvas: HTMLCanvasElement, gl: WebGLRenderingContext | null): void {
  const gpu = describeGpu(gl);
  let lostAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = (): void => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const arm = (): void => {
    clear();
    if (lostAt === null || document.visibilityState === "hidden") return;
    timer = setTimeout(giveUp, WEBGL_RECOVERY.restoreWaitMs);
  };

  const giveUp = (): void => {
    timer = undefined;
    if (lostAt === null) return;
    const history = readHistory();
    const now = Date.now();
    const reload = mayReloadAfterContextLoss(history, now);
    reportError("webgl.restoreTimeout", new Error("WebGL context not restored"), { ...gpu, waitedMs: now - lostAt, reload });
    if (!reload) return;
    writeHistory(nextReloadHistory(history, now));
    setTimeout(() => window.location.reload(), WEBGL_RECOVERY.reportGraceMs);
  };

  canvas.addEventListener("webglcontextlost", () => {
    lostAt = Date.now();
    noteBreadcrumb("webgl:lost");
    reportError("webgl.contextLost", new Error("WebGL context lost"), { ...gpu, hidden: document.visibilityState === "hidden" });
    arm();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    noteBreadcrumb(`webgl:restored+${lostAt === null ? 0 : Date.now() - lostAt}ms`);
    lostAt = null;
    clear();
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
