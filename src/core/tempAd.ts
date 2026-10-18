/**
 * 광고 SDK가 붙기 전까지 일반 빌드에서도 임시 광고 팝업을 거쳐 광고 보상을 받게 하는 스위치.
 *
 * **출시 전 임시 예외다**(응태 결정 — 베타·QA 인원이 "보상이 온다"는 감각을 즐기게 한다). 켜 두면 서버가
 * `temp-ad:<슬롯>` 토큰을 광고 완료로 받는다. 문자열 접두사는 서명이 아니라서 광고를 보지 않아도 클라이언트가
 * 만들어 보낼 수 있다(슬롯별 하루 한도는 서버가 그대로 지킨다). **정식 출시 전, 실제 광고 SSV(`verifyAdToken`)를
 * 연결하기 전에 반드시 `false`로 끈다** — 출시 차단 항목이다(`docs/release-fixture-cleanup.md`).
 */
export const TEMP_AD_REWARD_ENABLED = true;

/** 임시 광고 팝업을 끝까지 본 클라이언트가 보내는 토큰. QA 빌드의 `verified:` 토큰과 섞이지 않게 접두사를 가른다. */
export function tempAdToken(slotId: string): string {
  return `temp-ad:${slotId}`;
}
