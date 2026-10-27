/** 설정에서 노출하는 운영 문서만 열 수 있도록 경로의 범위를 고정한다. */
export type PolicyPath = "/terms" | "/privacy" | "/legal";

/** 테스트와 브라우저가 같은 팝업 차단 분기를 사용하도록 필요한 Window 표면만 정의한다. */
export interface PolicyWindow {
  location: Pick<Location, "href" | "assign">;
  open: (url?: string | URL, target?: string, features?: string) => Window | null;
  /** 앱 셸(Capacitor)이 주입하는 브리지다. 웹 빌드에는 없다. */
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { Browser?: { open: (options: { url: string }) => Promise<void> } } };
}

/** 정책 문서를 새 탭으로 열고, 브라우저가 팝업을 막으면 현재 탭에서 반드시 다시 연다. */
export function openPolicyDocument(path: PolicyPath, browser: PolicyWindow = window): void {
  // 운영 문서는 홈페이지에서 버전과 원문을 한곳에 관리한다.
  openHomepage(new URL(path, HOMEPAGE_ORIGIN).toString(), browser);
}

const HOMEPAGE_ORIGIN = "https://forgarden-web.vercel.app";

/**
 * iOS 앱 셸인가. iOS 빌드만 쿠폰을 게임 안에서 받지 않고 홈페이지로 보낸다 — App Store 지침(3.1.1)이
 * 앱 안의 코드 입력으로 디지털 재화를 여는 것을 문제 삼을 수 있어, 국내 게임 대부분이 iOS만 웹으로 돌린다.
 */
export function isIosApp(browser: PolicyWindow = window): boolean {
  return browser.Capacitor?.isNativePlatform?.() === true && browser.Capacitor?.getPlatform?.() === "ios";
}

/**
 * 홈페이지 쿠폰 페이지를 연다. 연결 티켓은 **조각(#)**에 싣는다 — 쿼리에 두면 서버 접속 기록과 Referer에
 * 남는다. 티켓이 없으면(서버 미연결) 빈 페이지가 열리고, 홈페이지가 게임에서 열라고 안내한다.
 */
export function openCouponPage(ticket: string | null, browser: PolicyWindow = window): void {
  const url = new URL("/coupon", HOMEPAGE_ORIGIN);
  if (ticket) url.hash = `t=${encodeURIComponent(ticket)}`;
  openHomepage(url.toString(), browser);
}

function openHomepage(url: string, browser: PolicyWindow): void {
  // 앱 안에서 현재 창을 갈아 끼우면 게임이 통째로 사라져 돌아올 길이 없다 — 시스템 브라우저로 연다.
  const native = browser.Capacitor?.isNativePlatform?.() === true;
  const appBrowser = browser.Capacitor?.Plugins?.Browser;
  if (native && appBrowser) { void appBrowser.open({ url }).catch(() => undefined); return; }
  const openedWindow = browser.open(url, "_blank", "noopener,noreferrer");
  if (!openedWindow && !native) browser.location.assign(url);
}
