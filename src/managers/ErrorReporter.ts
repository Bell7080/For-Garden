import packageInfo from "../../package.json";
import { apiFailureSink } from "../api/apiFailureSink";
import { backendAccount } from "../api/backendSession";
import { ClientErrorApi, type ClientErrorPayload } from "../api/ClientErrorApi";
import { LOCAL_SAVE_FLAVOR } from "../core/saveStorage";
import { Breadcrumbs, ERROR_REPORT_LIMITS, ReportThrottle, clip, describeError, isNoise, sanitizeContext, type ErrorReportKind } from "../core/errorReport";

/**
 * 오류를 서버(`client_errors`)로 모으는 유일한 문. 어디서든 `reportError("영역.무슨일", error, { 맥락 })`만 부른다.
 *
 * - **코드는 `영역.무슨일` 꼴이다**(`battle.settle`·`api.5xx`). 같은 코드·같은 스택은 서버가 한 줄로 묶는다.
 * - **절대 던지지 않는다** — 보고하다 죽으면 원래 오류를 가린다. 서버가 없거나 로그인 전이면 조용히 버린다.
 * - 개발 서버(`DEV`)와 E2E(`test`)는 보내지 않는다. QA·일반 빌드는 보내고 서버 행에 `build`가 남는다.
 * - 로그인 전에 난 오류는 작은 대기열(열 개)에 두었다가 다음 보고 때 함께 보낸다.
 * 보는 법과 AI에게 넘기는 법은 `docs/error-reports.md`.
 */
const breadcrumbs = new Breadcrumbs();
const throttle = new ReportThrottle();
let currentScene: string | null = null;
let installed = false;
const pending: ClientErrorPayload[] = [];
const PENDING_MAX = 10;

const enabled = (): boolean => !import.meta.env?.DEV && LOCAL_SAVE_FLAVOR !== "test";

/** 최근 조작 흔적을 남긴다(화면 이동·팝업 제목처럼 오류의 앞뒤를 읽을 단서). */
export function noteBreadcrumb(text: string): void { breadcrumbs.add(text); }
export function noteScene(key: string): void { currentScene = key.slice(0, ERROR_REPORT_LIMITS.scene); breadcrumbs.add(`scene:${key}`); }

async function flush(): Promise<void> {
  const account = backendAccount();
  if (!account) return;
  const api = new ClientErrorApi(account);
  while (pending.length > 0) {
    const next = pending.shift()!;
    const result = await api.report(next).catch(() => "network" as const);
    if (result === "network") return; // 연결이 불안하면 이 건은 버리고 멈춘다 — 되풀이 재전송은 오류를 더 만든다.
  }
}

export function reportError(code: string, error: unknown, context?: Record<string, unknown>, kind: ErrorReportKind = "report"): void {
  try {
    if (!enabled()) return;
    const { message, stack } = describeError(error);
    if (isNoise(message)) return;
    const signature = `${code}|${message.slice(0, 80)}|${(stack ?? "").split("\n").slice(0, 2).join("|")}`;
    if (!throttle.allow(signature)) return;
    const payload: ClientErrorPayload = {
      kind,
      code: clip(code, ERROR_REPORT_LIMITS.code) ?? null,
      message: clip(message, ERROR_REPORT_LIMITS.message) ?? "",
      stack: clip(stack, ERROR_REPORT_LIMITS.stack) ?? null,
      version: packageInfo.version,
      build: LOCAL_SAVE_FLAVOR,
      platform: "web",
      scene: currentScene,
      context: sanitizeContext(context),
      breadcrumbs: breadcrumbs.snapshot(),
    };
    if (pending.length >= PENDING_MAX) pending.shift();
    pending.push(payload);
    void flush();
  } catch { /* 보고가 원래 흐름을 깨면 안 된다 */ }
}

/** 부트에서 한 번. 잡히지 않은 오류와 처리되지 않은 Promise 거절을 모두 받는다. */
export function installErrorReporter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  apiFailureSink.report = (code, error, context) => reportError(code, error, context);
  window.addEventListener("error", (event) => {
    const where = event.filename ? `${event.filename.split("/").pop()}:${event.lineno}` : "";
    reportError("window.error", event.error ?? event.message, where ? { at: where } : undefined, "error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError("window.rejection", event.reason, undefined, "rejection");
  });
}

/** 콘솔에 남기던 오류를 서버 보고와 함께 남긴다. 기존 `console.error` 호출을 이것으로 바꾼다. */
export function logError(code: string, label: string, error: unknown, context?: Record<string, unknown>): void {
  console.error(label, error);
  reportError(code, error, { label, ...context });
}

/** `.catch(() => undefined)`로 삼키던 자리를 이것으로 바꾼다 — 흐름은 그대로 이어 가고 오류만 남긴다. */
export function reportCatch(code: string, context?: Record<string, unknown>): (error: unknown) => undefined {
  return (error) => { reportError(code, error, context); return undefined; };
}
