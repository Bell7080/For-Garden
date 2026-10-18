import type { AdPresentationResult } from "../api/contracts";
import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { TEMP_AD_REWARD_ENABLED, tempAdToken } from "../core/tempAd";

/** 네이티브 셸이 주입하는 최소 광고 SDK 계약이다. 웹 단독 빌드는 성공을 가장하지 않는다. */
interface RewardedAdBridge { present(slotId: string): Promise<AdPresentationResult>; }

declare global {
  interface Window { __PF_REWARDED_ADS__?: RewardedAdBridge; }
}

/** 임시 광고 팝업. 끝까지 보고 보상 받기를 눌렀으면 지급을 기다리는 손잡이, 도중에 닫혔으면 undefined. */
type TempAdPlayer = () => Promise<{ release(): void } | undefined>;
let tempAdPlayer: TempAdPlayer | undefined;
/** 보상 받기를 누른 뒤에도 팝업이 지급이 끝날 때까지 서 있게 쥐고 있는 손잡이. */
let heldAd: { release(): void } | undefined;

/**
 * 광고 뒤 지급(서버 확정·가방 갱신)이 끝났거나 실패했을 때 부른다. 임시 팝업이 「받는 중」으로 남아 있다가
 * 이때 닫혀, 광고가 끝난 화면과 보상 영수증 사이에 빈 틈이 생기지 않는다. 쥔 것이 없으면 아무 일도 하지 않는다.
 */
export function releaseAdWait(): void {
  const held = heldAd;
  heldAd = undefined;
  held?.release();
}

async function playTempAd(): Promise<boolean> {
  releaseAdWait();
  if (!tempAdPlayer) return true;
  heldAd = await tempAdPlayer();
  return heldAd !== undefined;
}

/** 늘 떠 있는 겹이 임시 광고 팝업을 띄우는 손잡이를 건다. 플랫폼 층이 화면을 import하지 않게 하는 경계다. */
export function setTempAdPlayer(player: TempAdPlayer | undefined): void {
  tempAdPlayer = player;
}

/** 씬과 SDK 전역을 분리하고, 미지원 환경에서는 검증 토큰 없는 명시적 실패만 반환한다. */
export async function presentRewardedAd(slotId: string): Promise<AdPresentationResult> {
  const bridge = typeof window === "undefined" ? undefined : window.__PF_REWARDED_ADS__;
  // QA 빌드에서만 서는 우회다 — 임시 3초 광고 팝업을 보여 준 뒤 광고를 본 것으로 치고
  // FakeServer 기본 검증이 받는 토큰을 돌려준다. 일반 빌드는 SDK 없이 성공을 흉내 내지 않는다.
  if (QA_TOOLS_ENABLED && !bridge) {
    if (!(await playTempAd())) return { status: "dismissed", reason: "temp_ad_closed" };
    return { status: "completed", verificationToken: `verified:${slotId}` };
  }
  // 출시 전 임시 예외 — 일반 빌드도 SDK 브릿지가 없는 동안 같은 팝업을 거쳐 임시 토큰을 받는다(`core/tempAd.ts`).
  if (TEMP_AD_REWARD_ENABLED && !bridge) {
    if (!(await playTempAd())) return { status: "dismissed", reason: "temp_ad_closed" };
    return { status: "completed", verificationToken: tempAdToken(slotId) };
  }
  if (!bridge) return { status: "unavailable", reason: "sdk_not_initialized" };
  return bridge.present(slotId);
}
