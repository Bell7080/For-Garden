/**
 * 한 계정은 한 기기에서만 플레이한다 — 나중에 접속한 기기가 이기고, 먼저 열려 있던 기기는 멈춘다.
 *
 * 앱이 뜰 때마다 이 기기(브라우저 탭 하나)만의 접속 표식을 새로 만들고, 서버 연결이 서는 순간 `session.claim`으로
 * 그 계정의 「지금 플레이하는 기기」를 이 표식으로 바꾼다. 그 뒤 모든 `/api/game` 호출은 본문에 표식을 싣고,
 * 서버는 표식이 지금 기기와 다르면 `409 session_replaced`로 거절한다(`vercelEntry.ts`). 그래서 다른 기기에서 접속한
 * 순간부터 이 기기의 조작은 하나도 저장되지 않는다 — 두 기기가 같은 저장을 번갈아 덮는 일(revision 충돌·되돌아간
 * 진행)이 처음부터 생기지 않는다.
 *
 * 호출이 없는 동안에도 알 수 있게 `startDeviceSessionWatch`가 잠깐씩(그리고 앱이 앞으로 돌아올 때) `session.check`를
 * 부른다. 거절을 받은 곳마다 오류를 읽지 않고 신호만 모아 겹 화면 한 곳이 「다른 기기에서 접속됨」 창을 띄운다.
 *
 * 표식은 토큰이 아니다 — 계정을 증명하지 않고(인증은 여전히 Bearer 토큰), 저장에도 남기지 않는다(앱을 새로 띄우면
 * 새 표식이다). 서버 연결이 없는 빌드(QA 로컬·E2E)에서는 아무것도 하지 않는다.
 */
type Listener = () => void;

export const DEVICE_SESSION_PATTERN = /^[a-f0-9]{24,64}$/;
/** 서버가 다른 기기의 접속으로 이 기기를 밀어냈을 때의 오류 코드다. */
export const SESSION_REPLACED_CODE = "session_replaced";
/** 호출이 없는 동안 다른 기기의 접속을 알아차리는 간격. 계정당 분당 300회 한도에 비하면 무시할 만하다. */
export const DEVICE_SESSION_CHECK_MS = 45_000;

function newDeviceSessionId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let deviceSessionId = newDeviceSessionId();
/** 서버에 이 기기를 지금 기기로 세운 뒤에만 표식을 싣는다 — 세우기 전의 호출이 다른 기기의 표식과 부딪히지 않게. */
let claimed = false;
let replaced = false;
const listeners = new Set<Listener>();

export function currentDeviceSessionId(): string { return deviceSessionId; }

/** 요청 본문에 덧붙일 값. 아직 세우지 않았으면 비운다(예전 서버·예전 흐름과 같다). */
export function deviceSessionField(): { device?: string } {
  return claimed && !replaced ? { device: deviceSessionId } : {};
}

export function markDeviceSessionClaimed(): void { claimed = true; replaced = false; }

/** 응답이 「다른 기기에서 접속됨」이면 알리고 true를 돌려준다. 같은 일을 호출이 여럿 알려도 한 번만 전달한다. */
export function noteDeviceSessionResponse(status: number, code: string | undefined): boolean {
  if (status !== 409 || code !== SESSION_REPLACED_CODE) return false;
  reportSessionReplaced();
  return true;
}

export function reportSessionReplaced(): void {
  if (replaced) return;
  replaced = true;
  stopDeviceSessionWatch();
  listeners.forEach((listener) => listener());
}

export function onSessionReplaced(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isSessionReplaced(): boolean { return replaced; }

/** 계정 전환·연결 해제 뒤 다음 연결이 새 표식으로 다시 세우게 한다. */
export function resetDeviceSession(): void {
  stopDeviceSessionWatch();
  deviceSessionId = newDeviceSessionId();
  claimed = false;
  replaced = false;
}

let watchTimer: ReturnType<typeof setInterval> | undefined;
let visibilityHandler: (() => void) | undefined;

/** 잠깐씩, 그리고 앱이 앞으로 돌아올 때 지금 기기가 맞는지 묻는다. `check`가 거절을 받으면 위 신호가 간다. */
export function startDeviceSessionWatch(check: () => Promise<unknown>, intervalMs = DEVICE_SESSION_CHECK_MS): void {
  stopDeviceSessionWatch();
  const tick = (): void => {
    if (replaced || !claimed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void check().catch(() => undefined);
  };
  watchTimer = setInterval(tick, intervalMs);
  if (typeof document !== "undefined") {
    visibilityHandler = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
}

export function stopDeviceSessionWatch(): void {
  if (watchTimer !== undefined) clearInterval(watchTimer);
  watchTimer = undefined;
  if (visibilityHandler && typeof document !== "undefined") document.removeEventListener("visibilitychange", visibilityHandler);
  visibilityHandler = undefined;
}

type FetchLike = typeof fetch;

async function postSession(method: "session.claim" | "session.check", token: string, endpoint: string, fetchImpl: FetchLike): Promise<{ status: number; code?: string; ok: boolean }> {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ method, args: [], device: deviceSessionId, ...(method === "session.claim" ? { requestId: newDeviceSessionId() } : {}) }),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
  return { status: res.status, ok: res.ok && json?.ok === true, ...(json?.code ? { code: json.code } : {}) };
}

/**
 * 이 기기를 그 계정의 지금 기기로 세운다(먼저 열려 있던 기기는 다음 호출에서 밀려난다). 서버가 아직 이 경계를
 * 모르면(예전 배포) 표식 없이 예전처럼 이어 간다 — 연결 자체를 막지 않는다.
 */
export async function claimDeviceSession(token: string, endpoint: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  claimed = false;
  replaced = false;
  try {
    const out = await postSession("session.claim", token, endpoint, fetchImpl);
    if (out.ok) markDeviceSessionClaimed();
    return out.ok;
  } catch {
    return false;
  }
}

/** 지금 기기가 맞는지 묻는다. 밀려났으면 신호를 보낸다. */
export async function checkDeviceSession(token: string | null, endpoint: string, fetchImpl: FetchLike = fetch): Promise<void> {
  if (!token || !claimed || replaced) return;
  const out = await postSession("session.check", token, endpoint, fetchImpl);
  noteDeviceSessionResponse(out.status, out.code);
}
