import type { RuneInstance } from "./runes";

/**
 * 특성 일괄 부여 — 가진 미지의 고대 핵으로 **특성이 없는 룬** 여럿에 특성을 한 번에 붙인다(응태 2026-11-22).
 *
 * - 대상은 특성이 없는 룬뿐이다. 이미 붙은 특성은 덮지 않는다 — 한 룬 부여 버튼이 특성 없는 룬에만
 *   서는 것과 같은 이유다(굴려 얻은 것을 한 번의 조작으로 잃지 않는다).
 * - 룬 하나에 핵 하나, 추첨은 한 룬 부여(`RUNE_TRAIT_ITEMS.grant`)와 같다.
 * - 고르는 창은 세공을 많이 한 룬부터 세운다(세공을 마친 룬이 먼저 특성을 받을 자리다).
 *
 * 화면(고를 수 있는 룬)과 서버(검증)가 같은 함수를 읽는다.
 */
export const RUNE_TRAIT_BULK_MAX = 100;

/** 일괄 부여를 받을 수 있는 룬인가. */
export function isRuneTraitBulkCandidate(rune: Pick<RuneInstance, "trait">): boolean {
  return rune.trait === undefined;
}

/** 한 번에 고를 수 있는 수 — 가진 핵과 요청 상한 중 작은 쪽. */
export function runeTraitBulkSelectable(cores: number): number {
  return Math.max(0, Math.min(Math.floor(cores), RUNE_TRAIT_BULK_MAX));
}

/** 특성이 없는 룬이 몇 개인가 — 연구대 줄이 「다 채우려면 핵이 몇 개 드나」를 말할 때 쓴다. */
export function runeTraitBulkCandidateCount(runes: readonly Pick<RuneInstance, "trait">[]): number {
  return runes.filter(isRuneTraitBulkCandidate).length;
}
