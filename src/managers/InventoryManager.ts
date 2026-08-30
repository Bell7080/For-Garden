import type { Wallet } from "../core/gacha";
import type { GameApi, InventoryItemDto, UseConsumableResponse } from "../api/contracts";
import type { RuneInstance } from "../core/runes";
import { findItem, ITEMS, type ItemCategory, type ItemDefinition, type WalletItemKey } from "../data/items";
import type { Session } from "../state/session";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";

/** 가방 UI와 순수 배치 테스트가 공유하는 두 열 카드 계약이다. */
export const INVENTORY_LAYOUT = {
  columns: 2,
  cardWidth: 390,
  cardHeight: 180,
  columnGap: 24,
  cellWidth: 414,
  cellHeight: 210,
  viewportWidth: 804,
  viewportHeight: 1074.9,
} as const;

export type InventoryGridLayout = Pick<typeof INVENTORY_LAYOUT, "columns" | "cellWidth" | "cellHeight" | "viewportHeight">;

/** 전달받은 열·행·보기 높이만으로 실제 항목 기반 스크롤 범위를 계산한다. */
export function inventoryScrollMetrics(itemCount: number, layout: InventoryGridLayout = INVENTORY_LAYOUT): { contentHeight: number; minY: number } {
  const contentHeight = Math.ceil(itemCount / layout.columns) * layout.cellHeight;
  return { contentHeight, minY: Math.min(0, layout.viewportHeight - contentHeight) };
}

/** 열 전체를 원점에 맞춰 카드 중심과 행 위치를 레이아웃 값에서 산출한다. */
export function inventoryGridPosition(index: number, layout: InventoryGridLayout = INVENTORY_LAYOUT): { x: number; y: number } {
  const column = index % layout.columns;
  return { x: (column - (layout.columns - 1) / 2) * layout.cellWidth, y: Math.floor(index / layout.columns) * layout.cellHeight };
}

/** UI가 룬·지갑·스택의 저장 위치를 몰라도 그릴 수 있는 읽기 전용 한 칸이다. */
export type InventoryDisplayItem =
  | { readonly kind: "rune"; readonly category: "rune"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: 1; readonly rune: RuneInstance }
  | { readonly kind: "currency"; readonly category: "currency"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: number; readonly walletKey: WalletItemKey }
  | { readonly kind: "stack"; readonly category: "consumable" | "material"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: number };

/** 씬의 직접 상태 변경을 막고 세 저장 모델을 표시 모델로만 합성한다. */
export class InventoryManager {
  constructor(private readonly state: Session, private readonly events: ManagerEvents = managerEvents) {}

  /** 조회와 세 저장 소유자의 반영을 한 비동기 경계로 묶어 서로 다른 시점의 행이 섞이지 않게 한다. */
  async refresh(api: GameApi): Promise<void> {
    const response = await api.getInventory();
    this.applySnapshot(response.items);
  }

  /** 소비 명령의 최종 서버 스냅샷까지 같은 경계에서 반영해 화면이 DTO를 보관하지 않게 한다. */
  async useConsumable(api: GameApi, itemId: string): Promise<UseConsumableResponse> {
    const response = await api.useConsumable({ itemId, quantity: 1 });
    this.applySnapshot(response.items, response.wallet);
    return response;
  }

  /** 전체 DTO를 먼저 검증·정규화하고 모두 성공한 뒤에만 Session 세 영역을 함께 교체한다. */
  private applySnapshot(items: readonly InventoryItemDto[], expectedWallet?: Wallet): void {
    const ids = new Set<string>();
    const wallet = {} as Wallet;
    const walletKeys = new Set<WalletItemKey>();
    const runes: RuneInstance[] = [];
    const stacks: Session["itemInventory"] = [];
    for (const item of items) {
      const definition = findItem(item.definitionId);
      // 서버가 보낸 표시 메타데이터는 신뢰하지 않고 로컬 카탈로그와 행 식별자만 검증한다.
      if (!definition || definition.category !== item.category || ids.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > definition.maxStack) throw new Error("INVALID_INVENTORY_RESPONSE");
      ids.add(item.id);
      if (item.category === "rune") {
        if (item.definitionId !== "rune" || item.quantity !== 1 || !item.rune || item.id !== item.rune.instanceId) throw new Error("INVALID_INVENTORY_RESPONSE");
        runes.push(structuredClone(item.rune));
      } else if (item.category === "currency") {
        const walletKey = definition.id as WalletItemKey;
        walletKeys.add(walletKey); wallet[walletKey] = item.quantity;
      } else {
        stacks.push({ itemId: definition.id, quantity: item.quantity });
      }
    }
    const requiredWalletKeys = ITEMS.filter(({ category }) => category === "currency").map(({ id }) => id as WalletItemKey);
    if (walletKeys.size !== requiredWalletKeys.length || requiredWalletKeys.some((key) => !walletKeys.has(key)) || (expectedWallet && requiredWalletKeys.some((key) => expectedWallet[key] !== wallet[key]))) throw new Error("INVALID_INVENTORY_RESPONSE");
    // 검증 도중 예외가 나면 기존 세션이 그대로 남도록 실제 대입은 마지막 세 문장에만 둔다.
    this.state.runeInventory = runes;
    this.state.wallet = wallet;
    this.state.itemInventory = stacks;
    // 세 영역의 대입이 모두 끝난 뒤에만 UI가 일관된 확정 스냅샷을 읽도록 연달아 발행한다.
    this.events.publish("wallet", { wallet: this.state.wallet });
    this.events.publishInventory();
  }

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
