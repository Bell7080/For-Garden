import { findAdRewardSlot, type AdRewardSlot } from "./adRewards";
import type { ItemDefinition } from "./items";
import { findItem } from "./items";

/**
 * 스테미나를 지금 채울 수 있는 수단.
 *
 * 획득처를 글로 나열하는 대신 **누를 수 있는 것만** 세우기 위한 표다. 세 수단이 모두 실제 서버
 * 경계를 지난다 — 소비품은 `useConsumable`, 다이아는 `rechargeStamina`, 광고는 기존 보상 슬롯의
 * `claimAdReward`다. 경계가 없는 수단은 여기에 넣지 않는다. 눌러도 아무 일이 없는 칸은 준비
 * 상태를 과장한다.
 */
export type StaminaRechargeSource =
  /** 가진 소비품을 그 자리에서 쓴다. 회복량은 아이템 정의가 소유한다. */
  | { readonly kind: "consumable"; readonly id: string; readonly itemId: string }
  /** 보유 재화를 정해진 값만큼 깎아 회복한다. 차감과 회복은 서버가 한 처리 단위로 확정한다. */
  | { readonly kind: "currency"; readonly id: string; readonly name: string; readonly currency: "gems"; readonly cost: number; readonly amount: number }
  /** 이미 있는 광고 보상 슬롯을 그대로 쓴다. 회복량·일일 한도는 그 슬롯이 소유한다. */
  | { readonly kind: "ad"; readonly id: string; readonly name: string; readonly slotId: string };

/**
 * 화면에 서는 순서이자 서버가 인정하는 수단 목록이다.
 *
 * 세 칸을 균등하게 세우므로 순서는 **손이 자주 가는 것부터**다 — 가진 것을 쓰는 토닉, 값을 치르는
 * 다이아, 시간을 치르는 광고.
 */
export const STAMINA_RECHARGE_SOURCES = [
  { kind: "consumable", id: "stamina-tonic", itemId: "stamina-tonic" },
  { kind: "currency", id: "stamina-gems", name: "긴급 보급", currency: "gems", cost: 30, amount: 60 },
  { kind: "ad", id: "stamina-ad", name: "보급 요청", slotId: "daily-stamina" },
] as const satisfies readonly StaminaRechargeSource[];

/** 요청 ID를 서버 허용 목록과 대조한다. 화면이 보낸 문자열을 그대로 믿지 않는다. */
export function findStaminaRechargeSource(id: string): StaminaRechargeSource | undefined {
  return STAMINA_RECHARGE_SOURCES.find((source) => source.id === id);
}

/** 재화로 채우는 수단만 골라 서버가 차감할 값을 돌려준다. */
export function staminaCurrencyRecharge(id: string): Extract<StaminaRechargeSource, { kind: "currency" }> | undefined {
  const source = findStaminaRechargeSource(id);
  return source?.kind === "currency" ? source : undefined;
}

/** 소비품 한 칸이 화면에 세울 정의와 회복량이다. 정의가 없거나 회복 효과가 아니면 세우지 않는다. */
export function staminaConsumable(itemId: string): { definition: ItemDefinition; amount: number } | undefined {
  const definition = findItem(itemId);
  if (!definition || definition.useEffect.kind !== "restore_stamina") return undefined;
  return { definition, amount: definition.useEffect.amount };
}

/** 광고 칸이 세울 슬롯 정의다. 회복량과 일일 한도는 광고 표가 그대로 소유한다. */
export function staminaAdSlot(slotId: string): { slot: AdRewardSlot; amount: number } | undefined {
  const slot = findAdRewardSlot(slotId);
  if (!slot || slot.reward.kind !== "currency" || slot.reward.currency !== "stamina") return undefined;
  return { slot, amount: slot.reward.amount };
}
