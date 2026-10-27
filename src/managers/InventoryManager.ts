import { hasRemoteState } from "../api/resultState";
import { GameApiError } from "../api/contracts";
import type { ItemLot } from "../core/itemLots";
import { releaseAdWait } from "../platform/rewardedAds";
import { isValidLotStack } from "../core/itemLots";
import type { Wallet } from "../core/gacha";
import type { ClaimAdRewardRequest, ClaimAdRewardResponse, EngraveRuneResponse, EnhanceRuneAllResponse, EnhanceRuneResponse, GameApi, InventoryItemDto, RechargeStaminaResponse, RenameRuneResponse, SellRunesResponse, SynthesizeRunesResponse, UseConsumableResponse } from "../api/contracts";
import type { RuneInstance, RuneStatKey } from "../core/runes";
import { RELICS } from "../data/relics";
import { findItem, ITEMS, type ItemCategory, type ItemDefinition, type WalletItemKey } from "../data/items";
import type { Session } from "../state/session";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";

/** 가방 UI와 순수 배치 테스트가 공유하는 두 열 카드 계약이다. */
export const INVENTORY_LAYOUT = {
  columns: 4,
  cardWidth: 180,
  cardHeight: 180,
  columnGap: 28,
  cellWidth: 208,
  cellHeight: 208,
  viewportWidth: 804,
  viewportHeight: 1074.9,
} as const;


/** 가방 정렬 선택은 UI 상태로 보관하고 Manager만 비교 규칙을 소유한다. */
export type InventorySortKey = "acquired" | "rarity" | "part" | "enhancement" | "equipped" | "relic";
export interface InventorySort { key: InventorySortKey; direction: "asc" | "desc"; }
/** 렐릭 순 정렬에서 아무도 안 낀 룬이 서는 자리 — 도감의 어느 렐릭보다 뒤. */
const UNEQUIPPED_RELIC_RANK = 1_000_000;

/** 룬 인스턴스 → 그 룬을 낀 렐릭의 도감 순서. 낀 룬만 든다. */
export function runeHolderOrder(relicProgress: Record<string, { heartGemSlots: readonly (string | null)[] }>): ReadonlyMap<string, number> {
  const order = new Map<string, number>();
  for (const [relicId, progress] of Object.entries(relicProgress)) {
    const rank = RELICS.findIndex(({ id }) => id === relicId);
    for (const id of progress.heartGemSlots) if (id !== null) order.set(id, rank < 0 ? RELICS.length : rank);
  }
  return order;
}

/** 렐릭 순 정렬 키: 낀 렐릭의 도감 순서 → 같은 렐릭 안에서는 부위 순. 안 낀 룬은 맨 뒤. */
export function runeRelicRank(holderOrder: ReadonlyMap<string, number>, rune: { instanceId: string; part: number }): number {
  return (holderOrder.get(rune.instanceId) ?? UNEQUIPPED_RELIC_RANK) * 10 + rune.part;
}

/** 렐릭 순으로 정렬한 사본(안정). 가방의 기본 정렬과 룬 고르기 판이 같은 규칙을 쓴다. */
export function sortRunesByRelic<T extends { instanceId: string; part: number }>(runes: readonly T[], relicProgress: Record<string, { heartGemSlots: readonly (string | null)[] }>): T[] {
  const order = runeHolderOrder(relicProgress);
  return [...runes].sort((a, b) => runeRelicRank(order, a) - runeRelicRank(order, b));
}

export const DEFAULT_INVENTORY_SORT: InventorySort = { key: "relic", direction: "asc" };
const RARITY_ORDER = { uncommon: 0, rare: 1, epic: 2, legendary: 3 } as const;

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
  | { readonly kind: "stack"; readonly category: "consumable" | "material"; readonly id: string; readonly definition: ItemDefinition; readonly quantity: number; /** 기한 있는 병은 남은 기간이 다른 묶음마다 한 칸이다. */ readonly lot?: ItemLot };

/** 씬의 직접 상태 변경을 막고 세 저장 모델을 표시 모델로만 합성한다. */
const pendingRecharges = new WeakMap<GameApi, Map<string, string>>();

export class InventoryManager {
  constructor(private readonly state: Session, private readonly events: ManagerEvents = managerEvents) {}

  /** 조회와 세 저장 소유자의 반영을 한 비동기 경계로 묶어 서로 다른 시점의 행이 섞이지 않게 한다. */
  async refresh(api: GameApi): Promise<void> {
    const response = await api.getInventory();
    if (!hasRemoteState(response)) this.applySnapshot(response.items);
    else this.publishCurrentInventory();
  }

  /** 소비 명령의 최종 서버 스냅샷까지 같은 경계에서 반영해 화면이 DTO를 보관하지 않게 한다. */
  async useConsumable(api: GameApi, itemId: string, lotExpiresAt?: string): Promise<UseConsumableResponse> {
    const response = await api.useConsumable({ itemId, quantity: 1, ...(lotExpiresAt !== undefined ? { lotExpiresAt } : {}) });
    if (!hasRemoteState(response)) this.applySnapshot(response.items, response.wallet);
    else this.publishCurrentInventory();
    return response;
  }

  /**
   * 재화로 스테미나를 채운다.
   *
   * 값과 회복량은 화면이 정하지 않는다 — 수단 ID만 보내고 서버가 표에서 읽어 한 처리 단위로
   * 확정한 뒤, 그 결과 보유량을 다시 읽어 반영한다. 응답의 지갑을 그대로 대입하지 않는 이유는
   * 소비품 경로와 같은 검증(카탈로그 대조·행 무결성)을 함께 지나야 하기 때문이다.
   */
  async rechargeStamina(api: GameApi, sourceId: string): Promise<RechargeStaminaResponse> {
    let pending = pendingRecharges.get(api);
    if (!pending) { pending = new Map(); pendingRecharges.set(api, pending); }
    const requestId = pending.get(sourceId) ?? rechargeRequestId();
    pending.set(sourceId, requestId);
    try {
      const response = await api.rechargeStamina({ sourceId, requestId });
      if (!hasRemoteState(response)) this.applySnapshot(response.items, response.wallet);
      else this.publishCurrentInventory();
      pending.delete(sourceId);
      return response;
    } catch (error) {
      // 규칙 거절은 확정된 실패다. 통신·저장 결과가 불명확하면 최초 명령을 계속 회수한다.
      if (error instanceof GameApiError && error.code !== "PERSISTENCE_FAILED"
        || error && typeof error === "object" && "status" in error && Number(error.status) >= 400 && Number(error.status) < 500) pending.delete(sourceId);
      throw error;
    }
  }

  /** 광고 보상도 같은 경계를 지난다. 검증은 서버가 하고 화면은 확정 결과만 다시 읽는다. */
  async claimAdReward(api: GameApi, request: ClaimAdRewardRequest): Promise<ClaimAdRewardResponse> {
    try {
      const response = await api.claimAdReward(request);
      // 일일 수령 횟수는 지갑이 아니라 별도 기록이라 서버 확정값을 그대로 옮긴다.
      if (!hasRemoteState(response)) {
        this.state.dailyAdRewards = { ...this.state.dailyAdRewards, date: response.dailyAdRewards.date, claimsBySlot: { ...response.dailyAdRewards.claimsBySlot } };
        this.applySnapshot(response.items, response.wallet);
      } else this.publishCurrentInventory();
      return response;
    } finally {
      // 광고 팝업이 「받는 중」으로 서 있다가 지급이 끝난 순간(성공·실패 모두) 닫혀 영수증과 빈 틈 없이 이어진다.
      releaseAdWait();
    }
  }

  private publishCurrentInventory(): void {
    this.events.publish("wallet", { wallet: this.state.wallet });
    this.events.publishInventory();
  }

  /** 전체 DTO를 먼저 검증·정규화하고 모두 성공한 뒤에만 Session 세 영역을 함께 교체한다. */
  applySnapshot(items: readonly InventoryItemDto[], expectedWallet?: Wallet): void {
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
        if (item.lots && !isValidLotStack({ itemId: definition.id, quantity: item.quantity, lots: item.lots })) throw new Error("INVALID_INVENTORY_RESPONSE");
        stacks.push({ itemId: definition.id, quantity: item.quantity, ...(item.lots ? { lots: item.lots.map((lot) => ({ ...lot })) } : {}) });
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

  /**
   * 잠금·즐겨찾기 표시를 서버 확정 결과로만 반영한다.
   *
   * 화면이 `RuneInstance`의 플래그를 직접 뒤집지 않는 이유는, 자물쇠가 판매를 실제로 막는
   * 값이라 표시와 판매 거부가 같은 한 곳에서 갈리지 않아야 하기 때문이다.
   */
  async markRune(api: GameApi, instanceId: string, mark: { locked?: boolean; bookmarked?: boolean }): Promise<RuneInstance> {
    const response = await api.markRune({ runeInstanceId: instanceId, ...mark });
    if (!hasRemoteState(response)) this.state.runeInventory = response.inventory.runes.map((rune) => structuredClone(rune));
    this.events.publishInventory();
    return response.rune;
  }

  /**
   * 세공·각인·이름 바꾸기의 확정 결과를 Session에 반영하고 목록에도 알린다.
   *
   * 세공 화면이 `GameApi`를 직접 부르면 룬은 바뀌는데 **가방이 그 사실을 모른다** — 각인을
   * 마치고 돌아와도 카드의 금색 테두리가 다시 열 때까지 안 붙었다. 룬을 바꾸는 모든 길은 이
   * 경계를 지나 `inventory` 신호를 한 번 내보낸다. 골드는 서버가 이미 지갑에서 뺐으므로 그
   * 확정값을 그대로 다시 알리기만 한다.
   */
  private applyRuneMutation<T extends { rune: RuneInstance; inventory: { runes: RuneInstance[] } }>(response: T): T {
    if (!hasRemoteState(response)) this.state.runeInventory = response.inventory.runes.map((rune) => structuredClone(rune));
    this.events.publish("wallet", { wallet: this.state.wallet });
    this.events.publishInventory();
    return response;
  }

  /** 한 옵션을 서버 난수로 한 번 세공한다. */
  async enhanceRune(api: GameApi, instanceId: string, statId: RuneStatKey): Promise<EnhanceRuneResponse> {
    return this.applyRuneMutation(await api.enhanceRune({ runeInstanceId: instanceId, statId }));
  }

  /** 남은 세공을 위 줄부터 전부 한 번에 돌린다. */
  async enhanceRuneAll(api: GameApi, instanceId: string): Promise<EnhanceRuneAllResponse> {
    return this.applyRuneMutation(await api.enhanceRuneAll({ runeInstanceId: instanceId }));
  }

  /** 모든 세공을 마친 룬에 한 번뿐인 각인을 새긴다. */
  async engraveRune(api: GameApi, instanceId: string, statId: RuneStatKey): Promise<EngraveRuneResponse> {
    return this.applyRuneMutation(await api.engraveRune({ runeInstanceId: instanceId, statId }));
  }

  /** 서버 이름 정책을 통과한 사용자 이름으로 바꾼다. */
  async renameRune(api: GameApi, instanceId: string, name: string): Promise<RenameRuneResponse> {
    return this.applyRuneMutation(await api.renameRune({ runeInstanceId: instanceId, name }));
  }

  /** 각인 완료 룬 셋을 합성한다. 응답의 확정 스냅샷(룬 목록·지갑)만 반영한다. */
  async synthesizeRunes(api: GameApi, instanceIds: readonly string[], requestId = crypto.randomUUID()): Promise<SynthesizeRunesResponse> {
    const response = await api.synthesizeRunes({ requestId, runeInstanceIds: instanceIds });
    if (!hasRemoteState(response)) this.state.wallet = { ...response.wallet };
    // 끼고 있던 재료는 합성과 함께 장착이 풀린다 — 응답의 장착표를 그대로 반영한다.
    if (!hasRemoteState(response)) {
      for (const { relicId, slots } of response.inventory.equipment) {
        const progress = this.state.relicProgress[relicId];
        if (progress) progress.heartGemSlots = [...slots];
      }
    }
    return this.applyRuneMutation(response);
  }

  /** 판매 응답의 확정 스냅샷만 Session에 반영하고 모든 상태 소비자에게 같은 시점으로 알린다. */
  async sellRunes(api: GameApi, instanceIds: string[], requestId = crypto.randomUUID()): Promise<SellRunesResponse> {
    const response = await api.sellRunes({ requestId, instanceIds });
    if (!hasRemoteState(response)) this.state.runeInventory = response.inventory.runes.map((rune) => structuredClone(rune));
    if (!hasRemoteState(response)) this.state.wallet = { ...response.wallet };
    this.events.publish("wallet", { wallet: this.state.wallet });
    this.events.publishInventory();
    return response;
  }

  /**
   * 화면에 세울 칸. 하나도 없는 재화는 칸을 세우지 않는다 — 빈 칸이 먼저 읽혀 가진 것이 묻히고,
   * 얻으면 그때 나타난다. 서버 DTO는 모든 재화 행이 필요하므로(`list`) 거르는 것은 표시뿐이다.
   */
  displayList(category: ItemCategory, sort: InventorySort = DEFAULT_INVENTORY_SORT): readonly InventoryDisplayItem[] {
    const rows = this.list(category, sort);
    return category === "currency" ? rows.filter((row) => row.quantity > 0) : rows;
  }

  /** 원본 DTO/Session 배열을 바꾸지 않고 결정적 tie-break를 포함한 안정 정렬 복사본을 만든다. */
  list(category: ItemCategory, sort: InventorySort = DEFAULT_INVENTORY_SORT): readonly InventoryDisplayItem[] {
    if (category === "rune") {
      const definition = findItem("rune")!;
      const equipped = new Set(Object.values(this.state.relicProgress).flatMap(({ heartGemSlots }) => heartGemSlots.filter((id): id is string => id !== null)));
      const holderOrder = runeHolderOrder(this.state.relicProgress);
      const original = this.state.runeInventory.map((rune, index) => ({ rune, index }));
      const value = ({ rune, index }: (typeof original)[number]): number => sort.key === "relic" ? runeRelicRank(holderOrder, rune) : sort.key === "acquired" ? (rune.sequence ?? index) : sort.key === "rarity" ? RARITY_ORDER[rune.rarity] : sort.key === "part" ? rune.part : sort.key === "enhancement" ? Object.values(rune.enhancementHistory).reduce((sum, history) => sum + (history?.length ?? 0), 0) : Number(equipped.has(rune.instanceId));
      const direction = sort.direction === "asc" ? 1 : -1;
      return [...original].sort((a, b) => direction * (value(a) - value(b)) || a.rune.instanceId.localeCompare(b.rune.instanceId) || a.index - b.index).map(({ rune }) => ({ kind: "rune" as const, category, id: rune.instanceId, definition, quantity: 1 as const, rune }));
    }
    if (category === "currency") {
      return ITEMS.filter((item) => item.category === "currency").map((definition) => {
        const walletKey = definition.id as keyof Wallet;
        return { kind: "currency", category, id: definition.id, definition, quantity: this.state.wallet[walletKey], walletKey };
      });
    }
    const rows: InventoryDisplayItem[] = this.state.itemInventory.flatMap((stack) => {
      const definition = findItem(stack.itemId);
      if (definition?.category !== category) return [];
      // 받은 시각이 다른 묶음은 한 칸에 합치지 않는다 — 7일 1개·6일 1개·10시간 3개가 각각 선다(사라질 순서대로).
      if (stack.lots?.length) return [...stack.lots].sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt)).map((lot) => ({ kind: "stack" as const, category, id: stack.itemId, definition, quantity: lot.quantity, lot }));
      return [{ kind: "stack" as const, category, id: stack.itemId, definition, quantity: stack.quantity }];
    });
    // 발굴권은 가방 스택이 아니라 고고학 입장 횟수 그 자체다(`state.archaeology.charges`, 시간 충전 + 초과분).
    // 스테미나처럼 가방에는 지금 가진 횟수로 서고, 저장 스택을 따로 두지 않아 두 곳이 갈리지 않는다.
    const ticket = findItem(STRATA_TICKET_ITEM);
    const charges = this.state.archaeology?.charges ?? 0;
    if (ticket?.category === category && charges > 0) rows.push({ kind: "stack", category, id: ticket.id, definition: ticket, quantity: charges });
    return rows;
  }
}

const STRATA_TICKET_ITEM = "strata-ticket";

/** 재시도해도 같은 충전이 두 번 확정되지 않도록 브라우저 난수와 시각을 함께 쓴다. */
function rechargeRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `stamina-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
