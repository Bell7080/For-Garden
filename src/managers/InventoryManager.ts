import type { Wallet } from "../core/gacha";
import type { RuneInstance } from "../core/runes";
import { findItem, ITEMS, type ItemCategory, type ItemDefinition, type WalletItemKey } from "../data/items";
import type { Session } from "../state/session";

/** 두 열, 210px 행, 1030px 보기 영역의 실제 항목 기반 스크롤 범위다. */
export function inventoryScrollMetrics(itemCount: number): { contentHeight: number; minY: number } {
  const contentHeight = Math.ceil(itemCount / 2) * 210;
  return { contentHeight, minY: Math.min(0, 1030 - contentHeight) };
}

/** UI가 룬·지갑·스택의 저장 위치를 몰라도 그릴 수 있는 읽기 전용 한 칸이다. */
export type InventoryDisplayItem =
  | { readonly kind: "rune"; readonly category: "rune"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: 1; readonly rune: RuneInstance }
  | { readonly kind: "currency"; readonly category: "currency"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: number; readonly walletKey: WalletItemKey }
  | { readonly kind: "stack"; readonly category: "consumable" | "material"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: number };

/** 씬의 직접 상태 변경을 막고 세 저장 모델을 표시 모델로만 합성한다. */
export class InventoryManager {
  constructor(private readonly state: Session) {}

  /** 카테고리 전환과 테스트가 같은 순수 필터 결과를 사용한다. */
  list(category: ItemCategory): readonly InventoryDisplayItem[] {
    if (category === "rune") {
      const definition = findItem("rune")!;
      return this.state.runeInventory.map((rune) => ({ kind: "rune", category, id: rune.instanceId, definition, quantity: 1, rune }));
    }
    if (category === "currency") {
      return ITEMS.filter((item) => item.category === "currency").map((definition) => {
        const walletKey = definition.id as keyof Wallet;
        return { kind: "currency", category, id: definition.id, definition, quantity: this.state.wallet[walletKey], walletKey };
      });
    }
    return this.state.itemInventory.flatMap((stack) => {
      const definition = findItem(stack.itemId);
      return definition?.category === category ? [{ kind: "stack" as const, category, id: stack.itemId, definition, quantity: stack.quantity }] : [];
    });
  }
}
