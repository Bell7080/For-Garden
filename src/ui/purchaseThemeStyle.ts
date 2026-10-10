import type { PurchaseThemeId } from "../core/purchaseTheme";

export type PurchaseDecor = "strata" | "rays" | "coins" | "ribbons" | "brackets";

export interface PurchaseThemeStyle {
  /** 판 바탕(어두운 쪽). */
  deep: number;
  /** 위에서 내려오는 조명 색. */
  light: number;
  /** 장식·구분선 색. */
  accent: number;
  /** 장식의 두 번째 색(아래 띠·더미). */
  warm: number;
  decor: PurchaseDecor;
}

/** 다섯 테마의 값. 틀은 이 표만 읽고, 테마가 늘어도 그리는 코드는 `decor` 한 가지를 더하는 것으로 끝난다. */
export const PURCHASE_THEME_STYLE: Readonly<Record<PurchaseThemeId, PurchaseThemeStyle>> = {
  archaeology: { deep: 0x16120d, light: 0xf2c98a, accent: 0xd9a35f, warm: 0x6b4a2b, decor: "strata" },
  gacha: { deep: 0x120f24, light: 0xc9a8ff, accent: 0xb68cff, warm: 0x5a3b9c, decor: "rays" },
  currency: { deep: 0x15160c, light: 0xffe27a, accent: 0xf5c542, warm: 0x8a6a14, decor: "coins" },
  pass: { deep: 0x0b1626, light: 0x8fd0ff, accent: 0x5fb4f0, warm: 0x1f5c94, decor: "ribbons" },
  basic: { deep: 0x10161e, light: 0xcfe3f5, accent: 0x7fb6e6, warm: 0x2a3b4d, decor: "brackets" },
};
