/**
 * 클라이언트 오류 보고의 순수 규칙 — 무엇을 보내고(정리·자르기), 얼마나 보내는지(세션 한도) 정한다.
 *
 * 보내는 쪽(`managers/ErrorReporter`)은 Phaser·네트워크를 만지고, 이 파일은 값만 만진다. 서버(`report_client_error`)가
 * 같은 길이 상한과 시간당 한도를 한 번 더 지키므로 여기 값을 바꾸면 마이그레이션의 상한과 함께 본다.
 * **개인정보·토큰은 보내지 않는다** — 이메일·토큰 모양·주소의 질의 문자열은 여기서 지운다.
 */

export type ErrorReportKind = "error" | "rejection" | "report";

export const ERROR_REPORT_LIMITS = {
  message: 500,
  stack: 4000,
  code: 64,
  scene: 48,
  contextJson: 3000,
  breadcrumbsJson: 3000,
  breadcrumbs: 20,
  breadcrumbText: 60,
  /** 한 세션(탭을 연 동안)에 보낼 수 있는 총 건수. 서버의 시간당 30건보다 아래다. */
  perSession: 20,
  /** 같은 오류는 세션에 한 번만 보낸다. 횟수는 서버가 새 세션마다 올린다. */
  minGapMs: 1500,
} as const;

/** 기기·계정이 드러나는 조각을 지운다. */
export function scrubText(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, "[token]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[long]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(https?:\/\/[^\s)?#]+)[?#][^\s)]*/g, "$1");
}

export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try { return { message: JSON.stringify(error) ?? String(error) }; } catch { return { message: String(error) }; }
}

export function clip(text: string | undefined, max: number): string | undefined {
  if (text === undefined) return undefined;
  return scrubText(text).slice(0, max);
}

/** 맥락 값은 평평한 원시값 객체만 받는다 — 중첩·함수·거대한 값이 서버로 새지 않게 한다. */
export function sanitizeContext(context: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!context) return out;
  let size = 2;
  for (const [key, value] of Object.entries(context)) {
    let v: string | number | boolean;
    if (typeof value === "number" && Number.isFinite(value)) v = value;
    else if (typeof value === "boolean") v = value;
    else if (typeof value === "string") v = scrubText(value).slice(0, 120);
    else continue;
    const k = key.slice(0, 40);
    size += k.length + String(v).length + 6;
    if (size > ERROR_REPORT_LIMITS.contextJson - 100) break;
    out[k] = v;
  }
  return out;
}

/** 최근 조작 흔적(화면 이동·팝업·버튼 이름). 고정 길이 링 — 오래된 것부터 밀려난다. */
export class Breadcrumbs {
  private readonly items: Array<{ t: number; c: string }> = [];
  constructor(private readonly now: () => number = Date.now) {}
  add(text: string): void {
    this.items.push({ t: this.now(), c: scrubText(text).slice(0, ERROR_REPORT_LIMITS.breadcrumbText) });
    if (this.items.length > ERROR_REPORT_LIMITS.breadcrumbs) this.items.shift();
  }
  /** `[[몇 초 전, 내용], …]` — 절대 시각 대신 상대 시간이라 읽기 쉽고 기기 시계에 기대지 않는다. */
  snapshot(): Array<[number, string]> {
    const end = this.now();
    const out = this.items.map((i): [number, string] => [Math.round((end - i.t) / 100) / 10, i.c]);
    while (out.length > 1 && JSON.stringify(out).length > ERROR_REPORT_LIMITS.breadcrumbsJson) out.shift();
    return out;
  }
}

/** 세션 한도와 같은 오류 중복 차단. 서버 쪽 fingerprint와 별개로, 보내기 전에 쏟아지는 것을 막는다. */
export class ReportThrottle {
  private sent = 0;
  private readonly seen = new Set<string>();
  private lastAt = -Infinity;
  constructor(private readonly now: () => number = Date.now) {}
  allow(signature: string): boolean {
    if (this.sent >= ERROR_REPORT_LIMITS.perSession) return false;
    if (this.seen.has(signature)) return false;
    const t = this.now();
    if (t - this.lastAt < ERROR_REPORT_LIMITS.minGapMs) return false;
    this.seen.add(signature);
    this.lastAt = t;
    this.sent += 1;
    return true;
  }
}

/** 브라우저가 던지는 무해한 잡음 — 고칠 수 있는 오류가 아니라서 보내지 않는다. */
export function isNoise(message: string): boolean {
  return /ResizeObserver loop|Script error\.?$|AbortError|The play\(\) request was interrupted|NotAllowedError.*play|Load failed$|Failed to fetch$|NetworkError|network request failed/i.test(message);
}
