import type { MailRewardDto } from "../api/contracts";
import { findItem } from "../data/items";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";

/**
 * 우편·출석처럼 `MailRewardDto`로 오는 보상 한 줄의 그림 키. 재화는 지갑 아이콘, 아이템은 제 정의의 그림이다.
 *
 * 두 화면이 같은 보상을 같은 그림으로 세우도록 한 곳에 둔다 — 따로 고르면 같은 토벌권이 우편과 출석에서
 * 다른 그림으로 선다.
 */
export function rewardDtoTexture(reward: MailRewardDto): string {
  if (reward.kind === "currency") return CURRENCY_ICON_BY_WALLET[reward.currency];
  const icon = findItem(reward.itemId)?.icon;
  return icon?.kind === "asset" ? icon.key : icon?.kind === "currency" ? CURRENCY_ICON_BY_WALLET[icon.key] : "";
}
