/**
 * 재화 아이콘.
 *
 * 파일은 `scripts/prepare_icons.py`가 구운 WebP다. 속성·직군과 달리 여러 색으로 그린 그림이라
 * 색을 코드에서 바꾸지 않는다. 어떤 재화를 어느 그림으로 보여 줄지만 여기서 정한다.
 */
export type CurrencyIconKey =
  | "currency-gems"
  | "currency-gold"
  | "currency-stamina"
  | "currency-fossil"
  | "currency-amber"
  | "currency-cheesecake"
  | "currency-dna";

export const CURRENCY_ICON_ASSETS: ReadonlyArray<readonly [CurrencyIconKey, string]> = [
  ["currency-gems", "/sprites/currency/crystal.webp"],
  ["currency-gold", "/sprites/currency/gold.webp"],
  ["currency-stamina", "/sprites/currency/energy.webp"],
  ["currency-fossil", "/sprites/currency/fossil.webp"],
  ["currency-amber", "/sprites/currency/amber.webp"],
  ["currency-cheesecake", "/sprites/currency/cake.webp"],
  ["currency-dna", "/sprites/currency/heart.webp"],
];

/** 저장 지갑 키를 실제 구운 WebP 텍스처로 바꾸는 공용 단일 매핑이다. */
export const CURRENCY_ICON_BY_WALLET = {
  gems: "currency-gems", gold: "currency-gold", stamina: "currency-stamina",
  fossil: "currency-fossil", amber: "currency-amber", cheesecake: "currency-cheesecake",
  dnaFragments: "currency-dna",
} as const satisfies Record<import("../data/items").WalletItemKey, CurrencyIconKey>;
