import { QA_TOOLS_ENABLED } from "./buildFlavor";

/** 서명 없는 임시 광고 토큰은 개발·QA에서만 쓴다. 일반 앱·서버 빌드에서 허용하지 않는다. */
export const TEMP_AD_REWARD_ENABLED: boolean = QA_TOOLS_ENABLED;

/** QA용 임시 팝업 토큰. 실제 광고 검증 서명이 아니다. */
export function tempAdToken(slotId: string): string {
  return `temp-ad:${slotId}`;
}
