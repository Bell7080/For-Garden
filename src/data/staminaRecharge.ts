import type { ItemDefinition } from "./items";
import { findItem } from "./items";

/**
 * 스테미나를 지금 채울 수 있는 수단.
 *
 * 획득처를 글로 나열하는 대신 **누를 수 있는 것만** 세우기 위한 표다. 아직 서버 경계가 없는
 * 수단(젬 충전·광고 보급)은 여기에 넣지 않는다 — 눌러도 아무 일이 없는 버튼은 준비 상태를
 * 과장하고, 그 자리를 비워 두는 것이 화면 규칙이다. 경계가 생기면 이 표에 한 줄을 더한다.
 */
export type StaminaRechargeSource =
  /** 가진 소비품을 그 자리에서 쓴다. 회복량은 아이템 정의가 소유한다. */
  | { readonly kind: "consumable"; readonly itemId: string };

export const STAMINA_RECHARGE_SOURCES: readonly StaminaRechargeSource[] = [
  { kind: "consumable", itemId: "stamina-tonic" },
];

/** 소비품 한 줄이 화면에 세울 정의와 회복량이다. 정의가 없거나 회복 효과가 아니면 세우지 않는다. */
export function staminaConsumable(itemId: string): { definition: ItemDefinition; amount: number } | undefined {
  const definition = findItem(itemId);
  if (!definition || definition.useEffect.kind !== "restore_stamina") return undefined;
  return { definition, amount: definition.useEffect.amount };
}
