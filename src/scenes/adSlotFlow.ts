import { gameApi } from "../api/FakeServer";
import { completedAdToken, findAdRewardSlot } from "../data/adRewards";
import { InventoryManager } from "../managers/InventoryManager";
import { presentRewardedAd } from "../platform/rewardedAds";
import { session } from "../state/session";

const inventory = new InventoryManager(session);

/** 그 광고 슬롯의 오늘 남은 횟수와 한도. 횟수는 서버가 날짜를 정규화해 준 기록(`dailyAdRewards`)만 읽는다. */
export function adSlotStatus(slotId: string): { used: number; limit: number; remaining: number } {
  const limit = findAdRewardSlot(slotId)?.dailyLimitUtc ?? 0;
  const used = session.dailyAdRewards.claimsBySlot[slotId] ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * 광고를 보고 그 슬롯의 보상을 받는다. 취소·SDK 미준비는 성공을 흉내 내지 않고 `false`를 돌려준다.
 * 지급과 횟수 확정은 서버가 하고, 가방·지갑은 그 결과를 다시 읽는다.
 */
export async function watchAdSlot(slotId: string): Promise<boolean> {
  const verificationToken = completedAdToken(await presentRewardedAd(slotId));
  if (!verificationToken) return false;
  const requestId = globalThis.crypto?.randomUUID?.() ?? `ad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await inventory.claimAdReward(gameApi, { slotId, verificationToken, requestId });
  return true;
}
