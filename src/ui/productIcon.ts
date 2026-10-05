import type { ProductDto } from "../api/contracts";
import { grantTiles } from "./premiumModel";

/**
 * 상품 칸에 서는 그림의 텍스처 키.
 *
 * **그림은 상품이 고른 임시 키(`iconKey`)가 아니라 첫 지급품에서 나온다.** 아홉 장을 돌려 쓰던 때는 에너지
 * 드링크가 치즈케이크 그림으로, 골드가 화석 그림으로 서서 칸의 그림과 가방에 들어온 것이 갈렸다.
 * 재화는 재화 그림, 아이템은 가방 칸과 같은 그림이라 산 것이 가방에서 무엇으로 서는지 그대로 읽힌다.
 * 지급품이 그림을 내지 않는 상품(패스 등)만 `iconKey`로 되돌아간다. 룬은 그림이 아니라 룬 액자라 여기 오지 않는다.
 */
export function productIconTexture(product: Pick<ProductDto, "grants" | "iconKey">): string {
  return grantTiles(product.grants)[0]?.icon ?? product.iconKey;
}

/** 룬을 파는 상품인가 — 그 칸은 재화 액자가 아니라 가방과 같은 룬 액자로 선다. */
export function runeProductOf(product: Pick<ProductDto, "grants" | "runePart">): { rarity: "uncommon" | "rare" | "epic" | "legendary"; part: 0 | 1 | 2 } | undefined {
  const grant = product.grants.find((candidate) => candidate.kind === "rune");
  if (grant?.kind !== "rune") return undefined;
  return { rarity: grant.rarity, part: product.runePart ?? grant.part ?? 0 };
}
