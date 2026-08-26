import type { AdPresentationResult } from "../api/contracts";

/** 네이티브 셸이 주입하는 최소 광고 SDK 계약이다. 웹 단독 빌드는 성공을 가장하지 않는다. */
interface RewardedAdBridge { present(slotId: string): Promise<AdPresentationResult>; }

declare global {
  interface Window { __PF_REWARDED_ADS__?: RewardedAdBridge; }
}

/** 씬과 SDK 전역을 분리하고, 미지원 환경에서는 검증 토큰 없는 명시적 실패만 반환한다. */
export async function presentRewardedAd(slotId: string): Promise<AdPresentationResult> {
  const bridge = typeof window === "undefined" ? undefined : window.__PF_REWARDED_ADS__;
  if (!bridge) return { status: "unavailable", reason: "sdk_not_initialized" };
  return bridge.present(slotId);
}
