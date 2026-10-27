import type { TextKey } from "../i18n";

/**
 * 가방 아이템의 「얻는 방법」 — 아이템 안내창(`ItemGuidePopup`)이 효과 아래에 줄마다 세운다.
 *
 * 문장은 키로만 든다(이벤트 목록과 같은 방식). 줄이 없는 아이템은 그 칸을 세우지 않는다 — 얻는 길을
 * 정하지 않은 아이템에 빈 칸이나 「없음」을 세우면 찾을 곳을 만들어 낸다. 새 수급처가 붙으면 여기에 한 줄을 더한다.
 */
export const ITEM_SOURCE_KEYS: Readonly<Record<string, readonly TextKey[]>> = {
  "raid-ticket": ["inventory.source.dungeonDrop", "inventory.source.strata", "inventory.source.premium"],
  "raid-select-ticket": ["inventory.source.raidPass"],
  "stamina-tonic": ["inventory.source.levelUp", "inventory.source.attendance", "inventory.source.shops", "inventory.source.ad"],
  "strata-ticket": ["inventory.source.attendance", "inventory.source.shops", "inventory.source.premium"],
  "sweep-ticket": ["inventory.source.ad", "inventory.source.premium"],
  "ancient-core": ["inventory.source.strata"],
  "refined-core": ["inventory.source.strata"],
  "restoration-crystal": ["inventory.source.strata"],
};

export function itemSourceKeys(itemId: string): readonly TextKey[] {
  return ITEM_SOURCE_KEYS[itemId] ?? [];
}
