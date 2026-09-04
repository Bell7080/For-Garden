import type { Wallet } from "../core/gacha";
import type { WalletItemKey } from "./items";

/** 교류 표본 교환의 제한 주기. 서버 시계로만 주기 키를 계산한다. */
export type InteractionExchangeRefresh = "daily" | "weekly" | "once";
/** 일반 상품과 섞지 않는 교류 전용 운영 정의다. */
export interface InteractionExchangeOffer { readonly id: string; readonly name: string; readonly requiredCityId: string; readonly cost: { readonly itemId: string; readonly amount: number }; readonly grants: readonly ({ readonly kind: "currency"; readonly currency: keyof Wallet; readonly amount: number } | { readonly kind: "item"; readonly itemId: string; readonly amount: number })[]; readonly refresh: InteractionExchangeRefresh; readonly exchangeLimit: number; readonly iconKey: WalletItemKey; }

/** 나이트 시티 SR 심령 표본의 희귀도와 기획 의도는 화면이 아니라 이 운영 데이터에만 둔다. */
export const INTERACTION_EXCHANGE_OFFERS = [{ id: "night-sr-psychic-sample-cheesecake", name: "나이트 표본 교환", requiredCityId: "night-ward", cost: { itemId: "sr-psychic-sample", amount: 1 }, grants: [{ kind: "currency", currency: "cheesecake", amount: 100 }], refresh: "weekly", exchangeLimit: 5, iconKey: "cheesecake" }] as const satisfies readonly InteractionExchangeOffer[];
/** 외부 요청 ID는 반드시 교류 전용 운영 표를 통과한다. */
export function findInteractionExchangeOffer(id: string): InteractionExchangeOffer | undefined { return INTERACTION_EXCHANGE_OFFERS.find((offer) => offer.id === id); }
