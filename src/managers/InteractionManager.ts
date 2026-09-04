import { gameApi } from "../api/FakeServer";
import type { ClaimInteractionDispatchResponse, ExchangeInteractionOfferResponse, GameApi, InteractionCitiesResponse, InteractionDispatchResponse, InteractionExchangeListResponse } from "../api/contracts";
import { managerEvents } from "./ManagerEvents";
import { findInteractionCity } from "../data/interactionCities";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type InteractionDispatchSnapshot, type Session } from "../state/session";

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
  async claim(dispatchId: string, requestId: string): Promise<ClaimInteractionDispatchResponse> { const response = await this.api.claimInteractionDispatch({ dispatchId, requestId }); this.apply(response); this.state.wallet = { ...response.wallet }; this.saves.save(this.state); return response; }
  /** 교류 교환 목록은 ProductDto 변환 없이 전용 DTO 그대로 검증된 UI 경계에 넘긴다. */
  async exchangeOffers(): Promise<InteractionExchangeListResponse> { return this.api.getInteractionExchangeOffers(); }
  /** 한 영수증의 아이템·지갑을 함께 반영하고 같은 tick에 두 갱신 이벤트를 발행한다. */
  async exchange(offerId: string, quantity: number, requestId: string): Promise<ExchangeInteractionOfferResponse> { const response = await this.api.exchangeInteractionOffer({ offerId, quantity, requestId }); this.state.wallet = { ...response.wallet }; this.state.itemInventory = response.items.filter(({ category }) => category === "consumable" || category === "material").map(({ definitionId, quantity: amount }) => ({ itemId: definitionId, quantity: amount })); this.saves.save(this.state); managerEvents.publish("wallet", { wallet: this.state.wallet }); managerEvents.publishInventory(); return response; }
  private apply<T extends InteractionDispatchResponse>(response: T): T { assertDispatch(response.dispatch); if (!Number.isFinite(Date.parse(response.serverTime))) throw new Error("교류 서버 시각이 올바르지 않습니다."); this.state.interaction.slots[0] = response.dispatch ? structuredClone(response.dispatch) : null; this.saves.save(this.state); return response; }
}

export const interactionManager = new InteractionManager();
