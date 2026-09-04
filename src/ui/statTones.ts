import type { RuneMainStatKey } from "../core/runes";
import type { ReachTier } from "../core/types";

/**
 * 다섯 능력치의 색.
 *
 * 능력치 레이더의 축 이름, 정보창의 능력치 칩, 룬 액자의 뒷배경이 모두 이 한 표를 읽는다.
 * 화면마다 제 나름의 색을 고르면 같은 능력치가 어디서는 초록, 어디서는 회색으로 보여
 * "무엇이 오르는 룬인가"를 색으로 먼저 읽을 수 없다.
 */
export const STAT_TONE: Readonly<Record<RuneMainStatKey, number>> = {
  hp: 0x6fc47f,
  atk: 0xe07a5f,
  def: 0x6f9bd8,
  res: 0xb08ad8,
  ap: 0x59c2c9,
};

/** 능력치 색을 텍스트 스타일이 받는 `#rrggbb` 문자열로 바꾼다. */
export function statToneHex(key: RuneMainStatKey): string {
  return `#${STAT_TONE[key].toString(16).padStart(6, "0")}`;
}

/**
 * 사거리 단계의 색과 이름.
 *
 * 붉은색이 가장 앞줄, 노란색이 가장 뒷줄이다 — 위험한 자리일수록 뜨겁게 읽히도록 골랐다.
 * 능력치 상세와 정보창이 같은 표를 읽으므로 화면이 제 나름의 색을 고르지 않는다.
 */
export const REACH_TONE: Readonly<Record<ReachTier, number>> = {
  melee: 0xe0574f,
  mid: 0x5b9be0,
  ranged: 0xe0b64a,
};

/** 화면에 적는 사거리 이름. */
export const REACH_LABEL: Readonly<Record<ReachTier, string>> = {
  melee: "근거리",
  mid: "중거리",
  ranged: "원거리",
};

/** 사거리 색을 텍스트 스타일이 받는 `#rrggbb` 문자열로 바꾼다. */
export function reachToneHex(tier: ReachTier): string {
  return `#${REACH_TONE[tier].toString(16).padStart(6, "0")}`;
}
