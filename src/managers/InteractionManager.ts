import { gameApi } from "../api/FakeServer";
import type { ClaimInteractionDispatchResponse, ExchangeInteractionOfferResponse, GameApi, InteractionCitiesResponse, InteractionDispatchResponse, InteractionExchangeListResponse } from "../api/contracts";
import { managerEvents } from "./ManagerEvents";
import { findInteractionCity } from "../data/interactionCities";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type InteractionDispatchSnapshot, type Session } from "../state/session";
import { findInteractionJournal, journalsForCity } from "../data/interactionJournals";
import { resolveJournalDiscovery, type JournalDiscoveryResolution } from "../core/interactionJournals";

/** 씬이 신뢰하지 않은 API DTO를 세션에 넣기 전 확인하는 작은 런타임 경계다. */
function assertDispatch(value: InteractionDispatchSnapshot | null): void {
  if (value === null) return;
  if (!value.dispatchId || !findInteractionCity(value.cityId) || value.party.length < 1 || value.party.length > 3 || new Set(value.party).size !== value.party.length || !Number.isFinite(Date.parse(value.startedAt)) || !Number.isFinite(Date.parse(value.completesAt))) throw new Error("교류 서버 응답이 올바르지 않습니다.");
}

/** API 검증·세션 반영·저장을 하나의 경계로 묶어 씬의 직접 상태 변경을 막는다. */
export class InteractionManager {
  constructor(private readonly api: GameApi = gameApi, private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}
  async cities(): Promise<InteractionCitiesResponse> { const response = await this.api.getInteractionCities(); if (!Number.isFinite(Date.parse(response.serverTime)) || response.cities.some(city => !findInteractionCity(city.id))) throw new Error("교류 도시 응답이 올바르지 않습니다."); return response; }
  async refresh(): Promise<InteractionDispatchResponse> { return this.apply(await this.api.getInteractionDispatch()); }
  async start(cityId: string, party: string[]): Promise<InteractionDispatchResponse> { return this.apply(await this.api.startInteractionDispatch({ cityId, party: [...party] })); }
  async claim(dispatchId: string, requestId: string): Promise<ClaimInteractionDispatchResponse> { const cityId = this.state.interaction.slots[0]?.cityId; const response = await this.api.claimInteractionDispatch({ dispatchId, requestId }); this.apply(response); this.state.wallet = { ...response.wallet }; if (cityId) this.discoverJournal(findInteractionCity(cityId)!.clueJournalId); this.saves.save(this.state); return response; }
  /** 신규 해금과 중복 대체를 수행하는 유일한 경계다. 완전 소진된 도시는 별도 중복 아이템을 주지 않는다. */
  discoverJournal(candidateId: string): JournalDiscoveryResolution {
    const journal = findInteractionJournal(candidateId);
    if (!journal) throw new RangeError("알 수 없는 교류 일지입니다.");
    const resolution = resolveJournalDiscovery(candidateId, journalsForCity(journal.cityId).map(({ id }) => id), this.state.discoveredInteractionJournalIds);
    if (!resolution.journalId) return resolution;
    const discovered = new Set(this.state.discoveredInteractionJournalIds).add(resolution.journalId);
    this.saves.save({ ...this.state, discoveredInteractionJournalIds: discovered });
    this.state.discoveredInteractionJournalIds = discovered;
    return resolution;
  }
  /** 열람 시작 시 읽음으로 확정해 도중 앱이 닫혀도 알림 점이 되살아나지 않게 한다. */
  markJournalRead(journalId: string): boolean {
    if (!this.state.discoveredInteractionJournalIds.has(journalId)) throw new RangeError("발견하지 않은 일지는 읽을 수 없습니다.");
    if (this.state.readInteractionJournalIds.has(journalId)) return false;
    const read = new Set(this.state.readInteractionJournalIds).add(journalId);
    this.saves.save({ ...this.state, readInteractionJournalIds: read });
    this.state.readInteractionJournalIds = read;
    return true;
  }
  /** 교류 교환 목록은 ProductDto 변환 없이 전용 DTO 그대로 검증된 UI 경계에 넘긴다. */
  async exchangeOffers(): Promise<InteractionExchangeListResponse> { return this.api.getInteractionExchangeOffers(); }
  /** 한 영수증의 아이템·지갑을 함께 반영하고 같은 tick에 두 갱신 이벤트를 발행한다. */
  async exchange(offerId: string, quantity: number, requestId: string): Promise<ExchangeInteractionOfferResponse> { const response = await this.api.exchangeInteractionOffer({ offerId, quantity, requestId }); this.state.wallet = { ...response.wallet }; this.state.itemInventory = response.items.filter(({ category }) => category === "consumable" || category === "material").map(({ definitionId, quantity: amount }) => ({ itemId: definitionId, quantity: amount })); this.saves.save(this.state); managerEvents.publish("wallet", { wallet: this.state.wallet }); managerEvents.publishInventory(); return response; }
  private apply<T extends InteractionDispatchResponse>(response: T): T { assertDispatch(response.dispatch); if (!Number.isFinite(Date.parse(response.serverTime))) throw new Error("교류 서버 시각이 올바르지 않습니다."); this.state.interaction.slots[0] = response.dispatch ? structuredClone(response.dispatch) : null; this.saves.save(this.state); return response; }
}

export const interactionManager = new InteractionManager();
