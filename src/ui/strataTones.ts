import type { StrataZoneTone } from "../data/strataLayers";
import { COLOR } from "./theme";

/**
 * 구역의 색.
 *
 * **탐사에는 숫자가 없다.** 확률도 기대값도 화면에 적지 않으므로, 「저쪽이 잘 나올 것 같다」를
 * 말하는 것은 이 색 하나뿐이다 — 판을 만들 때 이미 구역마다 색이 정해져 있었는데(`StrataZone`)
 * 화면이 그것을 한 번도 그리지 않아, 스물다섯 칸이 전부 같은 흙으로 보이고 어디를 파든 같은
 * 선택이 되었다.
 *
 * 흙빛은 **칠하지 않는다**(alpha 0) — 넷 중 가장 흔한 색이라 칠하면 판 전체가 물들어 특화
 * 구역이 도리어 묻힌다. 기본 흙 위에서 **다른 셋만 떠오르는 것**이 「여기는 다르다」를 말한다.
 *
 * 진하기는 **겉장 원화가 비칠 만큼만**이다. 0.2~0.28로 두었을 때는 구역이 또렷하긴 해도 판이
 * 흙이 아니라 색 필터를 한 겹 씌운 격자로 읽혔다 — 어디까지가 한 구역인지는 그보다 옅어도
 * 충분히 읽힌다.
 */
export const STRATA_ZONE_TONE: Readonly<Record<StrataZoneTone, { readonly color: number; readonly alpha: number }>> = {
  /** 평범한 흙. 판의 바탕이라 아무것도 얹지 않는다. */
  soil: { color: COLOR.archaeologySoil, alpha: 0 },
  /** 물기 어린 청록. 원석이 자주 드러나는 자리다. */
  teal: { color: COLOR.raritySR, alpha: 0.16 },
  /** 황금빛. 귀한 것이 기우는 자리라 강조색을 쓴다. */
  gold: { color: COLOR.accent, alpha: 0.19 },
  /** 가장 깊은 자리. 보랏빛이라 금색과 한 덩어리로 읽히지 않는다. */
  deep: { color: COLOR.raritySRAlt, alpha: 0.22 },
} as const;

/**
 * 기대도 게이지 다섯 칸의 색.
 *
 * 한 칸만 찬 줄과 다섯 칸이 찬 줄이 같은 색이면 길이를 견주어야 알 수 있다 — 아래에서
 * 위로 갈수록 등급색을 따라 올라가 **색만으로도** 어느 보상이 센지 읽힌다.
 */
export const ARCHAEOLOGY_RATING_TONE: readonly number[] = [
  COLOR.inkDimHex, COLOR.rarityR, COLOR.raritySR, COLOR.raritySSR, COLOR.raritySSRLight,
];

/** 다섯 칸 중 몇 칸이 찼는지로 그 줄의 색을 고른다. 빈 줄은 가장 흐린 색이다. */
export function archaeologyRatingColor(filled: number): number {
  return ARCHAEOLOGY_RATING_TONE[Math.min(ARCHAEOLOGY_RATING_TONE.length - 1, Math.max(0, filled - 1))];
}
