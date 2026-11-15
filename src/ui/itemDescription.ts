import { DUEL_DAILY_ATTEMPTS } from "../core/duelArena";
import { STRATA_CHARGE } from "../data/strataLayers";
import type { ItemDefinition } from "../data/items";

/**
 * 아이템 설명의 `{자리}`를 그 규칙을 가진 값으로 채운다.
 *
 * 설명에 수를 손으로 적어 두면 값이 바뀐 뒤에도 옛 수를 말한다 — 결투 도전권은 「다섯 장」, 발굴권은
 * 「3시간마다」를 문장에 박고 있었다. 회복량은 아이템의 사용 효과가, 충전은 그 규칙의 상수가 갖는다.
 */
export function itemDescriptionParams(definition: ItemDefinition): Readonly<Record<string, number>> {
  const params: Record<string, number> = {
    hours: Math.round(STRATA_CHARGE.intervalMs / 3_600_000),
    cap: STRATA_CHARGE.max,
    count: DUEL_DAILY_ATTEMPTS,
  };
  if (definition.useEffect.kind === "restore_stamina") params.amount = definition.useEffect.amount;
  return params;
}

export function itemDescription(definition: ItemDefinition): string {
  const params = itemDescriptionParams(definition);
  return definition.description.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}
