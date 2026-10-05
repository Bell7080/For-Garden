import { findItem } from "../data/items";
import type { ProductGrant } from "../data/products";

/**
 * 상품이 주는 기한 있는 아이템의 **가장 짧은 유통기한(일)**. 없으면 `undefined`.
 *
 * 지급하는 자리가 날수를 따로 정하면(`expiresInDays`) 그 값이 앞서고, 없으면 아이템 정의의 기본 날수다 —
 * 서버(`FakeServer.grantItem`)가 묶음에 새기는 규칙과 같은 순서라 상점에 적힌 날수와 가방의 날수가 갈리지 않는다.
 * 3일짜리를 파는지 7일짜리를 파는지가 사는 쪽에 보이지 않던 것이 이 표식을 만든 이유다.
 */
export function productExpiryDays(grants: readonly Pick<ProductGrant, "kind">[]): number | undefined {
  let shortest: number | undefined;
  for (const grant of grants as readonly ProductGrant[]) {
    if (grant.kind !== "item") continue;
    const days = grant.expiresInDays ?? findItem(grant.itemId)?.expiresInDays;
    if (days === undefined) continue;
    shortest = shortest === undefined ? days : Math.min(shortest, days);
  }
  return shortest;
}
