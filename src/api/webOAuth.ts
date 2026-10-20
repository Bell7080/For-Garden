/** OAuth는 별도 창에서 진행하고 PKCE verifier는 부모 창 메모리에만 둔다.
 * 콜백은 같은 origin·우리가 연 창에서 온 일회용 code만 받는다. 토큰/비밀번호는 postMessage하지 않는다. */
export interface OAuthBridge {
  authorize(buildUrl: (challenge: string, redirectTo: string) => Promise<string>): Promise<{ code: string; verifier: string } | null>;
}
const CALLBACK = 'pf_auth_callback';
const MESSAGE = 'forgarden.oauth.code';
export function finishOAuthPopup(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get(CALLBACK) !== '1') return false;
  const code = url.searchParams.get('code');
  const error = url.searchParams.has('error') || url.searchParams.has('error_code');
  window.history.replaceState(null, '', url.pathname);
  if (window.opener) {
    window.opener.postMessage({ type: MESSAGE, code: error ? null : code }, window.location.origin);
    // 부모가 코드를 받은 뒤 창을 닫는다. 먼저 닫으면 느린 기기에서 닫힘 감지가 메시지를 앞지를 수 있다.
  }
  // 코드 재사용을 막는다. 부모 창이 사라졌으면 평소 타이틀로 복귀한다.
  return !!window.opener;
}
export function createWebOAuthBridge(): OAuthBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return { async authorize(buildUrl) {
    const popup = window.open('about:blank', 'forgarden-account-auth', 'popup,width=520,height=720');
    if (!popup) return null;
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    let stop: () => void = () => undefined;
    const callback = new Promise<string | null>((resolve) => {
      let finished = false;
      const finish = (code: string | null) => { if (finished) return; finished = true; window.removeEventListener('message', message); clearInterval(timer); clearTimeout(timeout); resolve(code); };
      const message = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== popup || event.data?.type !== MESSAGE) return;
        finish(typeof event.data.code === 'string' && event.data.code.length <= 2048 ? event.data.code : null);
      };
      window.addEventListener('message', message);
      const timer = setInterval(() => { if (popup.closed) finish(null); }, 500);
      const timeout = setTimeout(() => finish(null), 300000);
      stop = () => finish(null);
    });
    try {
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const redirect = new URL(window.location.origin + '/'); redirect.searchParams.set(CALLBACK, '1');
      const url = new URL(await buildUrl(challenge, redirect.href));
      if (url.protocol !== 'https:') throw new Error('invalid_auth_redirect');
      if (popup.closed) return null;
      popup.location.href = url.href;
      const code = await callback;
      return code ? { code, verifier } : null;
    } finally { stop(); popup.close(); }
  } };
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
