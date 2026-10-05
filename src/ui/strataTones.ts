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
 * 기대도 게이지의 색은 **보상 그룹**이 정한다 — 원석은 보랏빛, 룬은 비취(초록~파랑), 재화는
 * 주황~노랑. 길이는 열 칸 중 몇 칸이냐가 말하고, 색은 무엇의 게이지인지를 말한다.
 * 채움이 찰수록 같은 계열에서 밝은 쪽으로 올라가 색만으로도 센 줄이 읽힌다.
 */
export const ARCHAEOLOGY_GROUP_TONE: Readonly<Record<"rawStone" | "rune" | "currency", { readonly low: number; readonly high: number }>> = {
  rawStone: { low: COLOR.archaeologyStone, high: 0xd2b4ff },
  rune: { low: 0x2fb6b0, high: 0x6fe3a8 },
  currency: { low: COLOR.archaeologyCurrency, high: 0xffd84a },
};

/** 게이지 열 칸 중 `filled`칸이 찼을 때의 색. 가득 찰수록 그룹의 밝은 쪽으로 기운다. */
export function archaeologyRatingColor(group: "rawStone" | "rune" | "currency", filled: number): number {
  const tone = ARCHAEOLOGY_GROUP_TONE[group];
  const t = Math.min(1, Math.max(0, (filled - 1) / 9));
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * t);
  const r = mix((tone.low >> 16) & 0xff, (tone.high >> 16) & 0xff);
  const g = mix((tone.low >> 8) & 0xff, (tone.high >> 8) & 0xff);
  const b = mix(tone.low & 0xff, tone.high & 0xff);
  return (r << 16) | (g << 8) | b;
}

/**
 * 안개의 색과 가장 짙을 때의 진하기.
 *
 * 구역 색을 칸마다 칠하던 것을 대신한다(`src/core/strataFog.ts`). 겹쳐 밝아지는 합성으로 깔리므로
 * 진하기는 옛 칸 색보다 높아도 흙 결이 비친다 — 두 겹이 엇갈려 일렁이는 동안 합이 이 값을
 * 넘지 않게 한 겹의 상한을 잡았다. 흙빛은 안개를 두르지 않는다.
 */
export const STRATA_FOG_TONE: Readonly<Record<StrataZoneTone, { readonly color: number; readonly alpha: number }>> = {
  soil: { color: COLOR.archaeologySoil, alpha: 0 },
  teal: { color: COLOR.raritySR, alpha: 0.44 },
  gold: { color: COLOR.accent, alpha: 0.46 },
  deep: { color: COLOR.raritySRAlt, alpha: 0.5 },
} as const;
