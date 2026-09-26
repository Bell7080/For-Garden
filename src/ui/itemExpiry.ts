import { nextExpiringLot, remainingLabel } from "../core/itemLots";
import { session } from "../state/session";

/**
 * 가방 한 칸에서 **가장 먼저 사라질 묶음**의 수와 남은 시간(`3D`·`5H`) — 가방 칸·안내창·스테미나
 * 창이 같은 한 마디를 쓴다. 기한이 없는 칸은 없다. 시각은 기기 시계로 재지만, 걷는 일은 서버가
 * 한다(`FakeServer.settleItemExpiry`) — 여기서는 보여 주기만 한다.
 */
export function soonestItemExpiry(itemId: string, now = new Date()): { count: number; time: string } | undefined {
  const lot = nextExpiringLot(session.itemInventory.find((stack) => stack.itemId === itemId));
  if (!lot || Date.parse(lot.expiresAt) <= now.getTime()) return undefined;
  return { count: lot.quantity, time: remainingLabel(lot.expiresAt, now) };
}
