/**
 * 로그인 수단 가운데 지금 실제로 쓸 수 있는 것.
 *
 * 소셜 로그인(Google·Apple)과 메일 인증 로그인은 앱 심사·키 발급이 끝나기 전이라 아직 열지 않는다(응태 2026-11-20).
 * 닫힌 수단은 버튼을 숨기지 않고 「준비 중」 딱지로 세운다 — 누르면 게스트나 아이디 계정으로 시작하라는 안내가 뜬다.
 * 열 때는 이 표의 값만 `true`로 바꾼다. 타이틀과 환경설정이 같은 표를 읽는다.
 *
 * Phaser를 읽지 않는다.
 */
export type LoginProvider = "google" | "apple" | "email";

export const LOGIN_PROVIDER_READY: Readonly<Record<LoginProvider, boolean>> = {
  google: false,
  apple: false,
  email: false,
};

export function loginProviderReady(provider: LoginProvider): boolean {
  return LOGIN_PROVIDER_READY[provider];
}
