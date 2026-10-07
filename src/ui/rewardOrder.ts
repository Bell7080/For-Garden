import { ITEMS } from "../data/items";
import { sortByRewardPriority, type RewardPriorityVirtualKey } from "../data/rewardPriority";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { RewardPopupItem } from "./rewardPopupModel";

/** 그림 키(텍스처) → 중요도 키. 재화 그림은 지갑 키, 아이템 그림은 아이템 ID, 룬 조각은 `rune`이다. */
let keyByIcon: ReadonlyMap<string, string> | undefined;
export function rewardKeyOfIcon(icon: string): string {
  keyByIcon ??= new Map<string, string>([
    ...Object.entries(CURRENCY_ICON_BY_WALLET).map(([wallet, texture]) => [texture, wallet] as const),
    ...ITEMS.flatMap((item) => item.icon.kind === "asset" ? [[item.icon.key, item.id] as const] : []),
  ]);
  if (icon.startsWith("rune-")) return "rune" satisfies RewardPriorityVirtualKey;
  return keyByIcon.get(icon) ?? icon;
}

/** 보상 액자 한 칸의 중요도 키. */
export function rewardItemKey(item: Pick<RewardPopupItem, "icon" | "relicId" | "runeInstanceId">): string {
  if (item.relicId) return "relicFragment" satisfies RewardPriorityVirtualKey;
  if (item.runeInstanceId) return "rune" satisfies RewardPriorityVirtualKey;
  if (typeof item.icon !== "string") return "profileDecoration" satisfies RewardPriorityVirtualKey;
  return rewardKeyOfIcon(item.icon);
}

/** 보상 팝업·영수증이 세우는 액자 목록을 중요도 순으로 정렬한다. */
export function sortRewardItems<T extends Pick<RewardPopupItem, "icon" | "relicId" | "runeInstanceId">>(items: readonly T[]): T[] {
  return sortByRewardPriority(items, rewardItemKey);
}
