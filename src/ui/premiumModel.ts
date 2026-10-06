import type { ProductDto } from "../api/contracts";
import type { PremiumCategory } from "../data/products";
import { progressPassForProduct } from "../data/progressPasses";
import { currencyRecordToRewardItems, productGrantsToRewardItems } from "./rewardPopupModel";

/** 프리미엄 화면이 자기 storefront 상품만 보존하는 순수 표시 모델이다. */
export function premiumModel(products: readonly ProductDto[]): ProductDto[] {
  // 서버가 잘못 합친 응답도 상점·무역 카드가 프리미엄에 새지 않도록 거른다.
  return products.filter((product) => product.storefront === "premium");
}

/**
 * 그 상품이 어느 라벨 아래 서는가.
 *
 * **갈래를 적지 않은 상품은 패키지로 본다.** 카탈로그에 새 상품을 넣으면서 갈래를 빠뜨려도
 * 목록에서 사라지지 않게 하려는 것이다 — 사라진 상품은 화면 어디에도 없어 빠뜨린 것을
 * 알아챌 방법이 없다.
 */
export function premiumCategoryOf(product: ProductDto): PremiumCategory {
  return product.premiumCategory ?? "package";
}

/** 라벨은 storefront 검증을 통과한 상품 중 그 갈래만 새 배열로 반환한다. */
export function productsForPremiumCategory(products: readonly ProductDto[], category: PremiumCategory): ProductDto[] {
  return premiumModel(products).filter((product) => premiumCategoryOf(product) === category);
}

/** 카드에 서는 받는 것 한 칸. 그림 키와 수량, 매일 받는 몫인지만 든다. */
export interface PremiumGrantTile {
  /** 공용 액자가 읽는 텍스처 키(재화 그림 · 아이템 그림). */
  icon: string;
  amount: number;
  /** 패스가 매일 얹는 몫 — 액자 모서리에 「매일」 표식이 선다. */
  daily?: boolean;
}

/**
 * 그 상품이 주는 것을 카드의 액자 목록으로 바꾼다.
 *
 * **지급 목록이 곧 화면이다.** 설명 문장을 따로 두지 않고 `grants`(그리고 패스가 매일 얹는 다이아)에서
 * 그대로 만들므로, 지급을 고치면 카드가 함께 바뀐다. 그림이 없는 지급(프로필 장식)은 칸을 세우지 않고
 * `premiumDecorationNames`가 한 줄로 알린다.
 */
export function premiumGrantTiles(product: Pick<ProductDto, "grants" | "passBenefit"> & { id?: string }): PremiumGrantTile[] {
  // 진행 패스는 사는 순간 주는 것이 없고 길의 마디가 준다 — 카드에는 유료 칸 전체의 합을 세워 무엇을 사는지 말한다.
  const pass = product.id === undefined ? undefined : progressPassForProduct(product.id);
  if (pass) return progressPassPaidTiles(pass.milestones.flatMap((milestone) => milestone.rewards));
  const tiles: PremiumGrantTile[] = productGrantsToRewardItems(product.grants).flatMap((item) =>
    typeof item.icon === "string" ? [{ icon: item.icon, amount: item.amount }] : []);
  const daily = product.passBenefit?.dailyBonus;
  if (daily) tiles.push(...currencyRecordToRewardItems({ [daily.currency]: daily.amount }).map((item) => ({ icon: item.icon as string, amount: item.amount, daily: true })));
  return tiles;
}

/** 패스 유료 칸의 같은 재화를 모은 액자 목록 — 다이아가 맨 앞이고 나머지는 많은 순이다. */
export function progressPassPaidTiles(rewards: ProductDto["grants"]): PremiumGrantTile[] {
  const totals = new Map<string, number>();
  for (const tile of grantTiles(rewards)) totals.set(tile.icon, (totals.get(tile.icon) ?? 0) + tile.amount);
  const gems = grantTiles([{ kind: "currency", currency: "gems", amount: 1 }])[0]?.icon;
  return [...totals].map(([icon, amount]) => ({ icon, amount })).sort((a, b) => (a.icon === gems ? -1 : b.icon === gems ? 1 : b.amount - a.amount));
}

/** 칸이 없는 지급(프로필 장식)의 이름들. */
export function premiumDecorationNames(product: Pick<ProductDto, "grants">): string[] {
  return product.grants.flatMap((grant) => grant.kind === "profile_decoration" ? [grant.name] : []);
}

/** 첫 구매 보너스로 같은 팩이 한 번 더 얹는 다이아 수(없거나 이미 받았으면 0). */
export function premiumFirstBonusGems(product: Pick<ProductDto, "firstPurchaseBonus" | "firstBonusAvailable">): number {
  if (!product.firstBonusAvailable) return 0;
  return (product.firstPurchaseBonus ?? []).reduce((sum, grant) => grant.kind === "currency" && grant.currency === "gems" ? sum + grant.amount : sum, 0);
}

/** 지급 목록 하나를 액자 칸으로 바꾼다. 그림이 없는 지급은 칸을 세우지 않는다. */
export function grantTiles(grants: ProductDto["grants"]): PremiumGrantTile[] {
  return premiumGrantTiles({ grants, passBenefit: undefined });
}
