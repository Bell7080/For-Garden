/** 설정에서 노출하는 운영 문서만 열 수 있도록 경로의 범위를 고정한다. */
export type PolicyPath = "/terms" | "/privacy";

/** 테스트와 브라우저가 같은 팝업 차단 분기를 사용하도록 필요한 Window 표면만 정의한다. */
export interface PolicyWindow {
  location: Pick<Location, "href" | "assign">;
  open: (url?: string | URL, target?: string, features?: string) => Window | null;
}

/** 정책 문서를 새 탭으로 열고, 브라우저가 팝업을 막으면 현재 탭에서 반드시 다시 연다. */
export function openPolicyDocument(path: PolicyPath, browser: PolicyWindow = window): void {
  // 절대 URL을 넘기면 하위 경로에서 실행되는 배포와 직접 접근에서도 같은 출처를 유지할 수 있다.
  const url = new URL(path, browser.location.href).toString();
  const openedWindow = browser.open(url, "_blank", "noopener,noreferrer");
  if (!openedWindow) browser.location.assign(url);
}
