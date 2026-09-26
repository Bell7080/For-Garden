import { gameApi } from "../api/FakeServer";
import type { PlayerStateDto } from "../api/contracts";
import { SWEEP_TICKET_ITEM } from "../core/dungeonShortcut";
import { completedAdToken, findAdRewardSlot } from "../data/adRewards";
import { InventoryManager } from "../managers/InventoryManager";
import { presentRewardedAd } from "../platform/rewardedAds";
import { session } from "../state/session";
import type { DungeonLobbyTickets } from "../ui/DungeonLobby";

/** 소탕권을 채우는 광고 슬롯. 한 번에 몇 장·하루 몇 번인지는 슬롯 표(`AD_REWARD_SLOTS`)가 갖는다. */
export const SWEEP_TICKET_AD_SLOT = "sweep-tickets";

const inventory = new InventoryManager(session);

/** 지금 가방에 든 소탕권 수. */
export function heldSweepTickets(): number {
  return session.itemInventory.find(({ itemId }) => itemId === SWEEP_TICKET_ITEM)?.quantity ?? 0;
}

/**
 * 던전 입구의 소탕권 줄. **멤버십이면 비운다** — 소탕권이 들지 않으므로 세울 까닭이 없다.
 *
 * 광고 사용 횟수는 서버가 날짜를 정규화해 돌려준 값(`dailyAdRewards`)만 읽는다 — 기기 시계로
 * 날짜를 가르면 시계를 돌려 횟수를 되살리는 길이 생긴다. 아직 모르면 한 번도 안 본 것으로 둔다.
 */
export function sweepTicketState(adFreeMembership: boolean, dailyAdRewards?: PlayerStateDto["dailyAdRewards"]): DungeonLobbyTickets | undefined {
  if (adFreeMembership) return undefined;
  const slot = findAdRewardSlot(SWEEP_TICKET_AD_SLOT);
  const limit = slot?.dailyLimitUtc ?? 0;
  const used = dailyAdRewards?.claimsBySlot[SWEEP_TICKET_AD_SLOT] ?? 0;
  const quantity = slot?.reward.kind === "item" ? slot.reward.quantity : 0;
  return { held: heldSweepTickets(), adRemaining: Math.max(0, limit - used), adLimit: limit, adQuantity: quantity };
}

/**
 * 광고를 보고 소탕권을 받는다. 취소·SDK 미준비는 성공을 흉내 내지 않고 `undefined`를 돌려준다.
 * 지급과 횟수 확정은 서버가 하고, 가방은 그 결과를 다시 읽는다.
 */
export async function watchSweepTicketAd(): Promise<PlayerStateDto["dailyAdRewards"] | undefined> {
  const verificationToken = completedAdToken(await presentRewardedAd(SWEEP_TICKET_AD_SLOT));
  if (!verificationToken) return undefined;
  const requestId = globalThis.crypto?.randomUUID?.() ?? `sweep-ad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await inventory.claimAdReward(gameApi, { slotId: SWEEP_TICKET_AD_SLOT, verificationToken, requestId });
  return response.dailyAdRewards;
}
