/**
 * 첫 로그인 때 받는 약관·처리방침 동의의 판.
 *
 * 문서 원문은 홈페이지(`content/legal/<판>.json`)가 갖고 게임은 고정 주소만 연다. 문서 판이 바뀌어 다시
 * 동의를 받아야 할 때는 여기 한 줄만 고친다 — 기기에 남은 키와 달라져 다음 로그인에서 다시 묻는다.
 * 현재 판은 시행 전 초안이다. 시행일이 정해지면 시행 판의 이름으로 바꾼다.
 */
export const LEGAL_VERSIONS = { terms: "2026-10-27-draft-4", privacy: "2026-10-27-draft-4" } as const;

/** 기기에 남기는 동의 키. 두 문서의 판을 함께 담는다. */
export function legalConsentKey(versions: { terms: string; privacy: string } = LEGAL_VERSIONS): string {
  return `terms:${versions.terms}|privacy:${versions.privacy}`;
}

/** 저장된 키가 지금 판에 대한 동의인지. */
export function legalConsentCurrent(stored: string): boolean {
  return stored === legalConsentKey();
}
