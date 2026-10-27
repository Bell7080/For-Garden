import { QA_TOOLS_ENABLED } from "./buildFlavor";

/** 서명 없는 임시 광고 토큰은 개발·QA에서만 쓴다. 일반 앱·서버 빌드에서 허용하지 않는다. */
export const TEMP_AD_REWARD_ENABLED: boolean = QA_TOOLS_ENABLED;

/** QA용 임시 팝업 토큰. 실제 광고 검증 서명이 아니다. */
export function tempAdToken(slotId: string): string {
  return `temp-ad:${slotId}`;
}

/**
 * 출시 전 자리표시 광고 — 실제 광고 SDK가 붙기 전까지 일반 빌드에서도 「광고 실행 중」 팝업이 보상까지 이어지게 한다.
 * 실제 광고 브리지(`__PF_REWARDED_ADS__`)와 서버 검증자(`verifyAdToken`)가 주입되면 그쪽이 먼저 쓰이고 이 경로는 쓰이지 않는다.
 * **출시 차단:** 실제 광고로 교체한 뒤 이 상수를 false로 내리고 관련 코드를 지운다(`docs/release-fixture-cleanup.md`).
 */
export const PLACEHOLDER_AD_ENABLED: boolean = true;

/** 자리표시 광고 팝업 토큰. QA 토큰(`temp-ad:`)과 접두사를 갈라 QA 도구와 섞이지 않는다. */
export function placeholderAdToken(slotId: string): string {
  return `placeholder-ad:${slotId}`;
}
