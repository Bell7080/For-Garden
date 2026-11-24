import { runeBatchEnhancementTargets, type RuneInstance, type RuneStatKey } from "./runes";

/**
 * 룬 일괄 세공 — 고른 룬 여럿의 남은 세공을 한 번에 돌리고, 원하면 각인까지 새긴다.
 *
 * 한 룬 안의 세공 순서는 한 룬 일괄 세공(`runeBatchEnhancementTargets` — 위 줄부터)과 같다. 각인은 되돌릴 수 없는
 * 마지막 선택이라 **어느 주 옵션에 새길지를 사람이 한 번 고른다**(위 주 옵션 · 아래 주 옵션). 룬마다 주 옵션이 달라도
 * 「위 / 아래」라는 자리는 모든 룬에 같으므로 한 번의 선택으로 여럿을 묶을 수 있다. 각인을 고르지 않으면 세공만 한다.
 *
 * 화면(무엇을 몇 회 돌리나·얼마 드나)과 서버(실제 판정)가 이 모듈 하나를 읽는다.
 */

/** 각인할 주 옵션의 자리. `null`이면 각인하지 않는다. */
export type RuneBulkEngrave = 0 | 1 | null;

/** 한 룬에 일괄 세공이 할 일 — 남은 세공 횟수와 각인 여부. */
export interface RuneBulkCraftWork {
  readonly enhancements: number;
  readonly engrave: boolean;
}

/** 이 룬에 일괄 세공이 할 일. 세공이 끝난 룬은 각인을 고른 때만 각인이 남는다. */
export function runeBulkCraftWork(rune: RuneInstance, engrave: RuneBulkEngrave): RuneBulkCraftWork {
  const enhancements = runeBatchEnhancementTargets(rune).length;
  // 세공이 남은 룬도 세공을 마치는 순간 각인할 수 있다 — 각인 전인 룬이면 함께 새긴다.
  const engraves = engrave !== null && rune.engravings.length === 0;
  return { enhancements, engrave: engraves };
}

/** 일괄 세공에 넣을 수 있는 룬인가 — 할 일이 하나라도 남았다. */
export function isRuneBulkCraftCandidate(rune: RuneInstance, engrave: RuneBulkEngrave): boolean {
  const work = runeBulkCraftWork(rune, engrave);
  return work.enhancements > 0 || work.engrave;
}

/** 고른 자리의 각인 대상 옵션. 세공을 다 마친 룬에서만 쓴다. */
export function runeBulkEngraveStat(rune: RuneInstance, engrave: 0 | 1): RuneStatKey {
  return rune.mainStats[engrave].key;
}

/** 고른 룬들의 일을 합친다 — 확인 창이 「룬 N개 · 세공 M회 · 각인 K개」로 말한다. */
export function runeBulkCraftTotals(runes: readonly RuneInstance[], engrave: RuneBulkEngrave): { runes: number; enhancements: number; engravings: number } {
  let enhancements = 0;
  let engravings = 0;
  let count = 0;
  for (const rune of runes) {
    const work = runeBulkCraftWork(rune, engrave);
    if (work.enhancements === 0 && !work.engrave) continue;
    count += 1;
    enhancements += work.enhancements;
    if (work.engrave) engravings += 1;
  }
  return { runes: count, enhancements, engravings };
}

/**
 * 고른 룬이 모두 세공을 마쳐 각인만 남았는가 — 그때 버튼·확인 창·안내가 「세공」이 아니라 「각인」을 말한다
 * (응태 2026-11-24). 세공이 다 끝나야 각인이 되므로 따로 고르는 판을 두지 않고 같은 판에서 이름만 바뀐다.
 */
export function isRuneBulkEngraveOnly(totals: { runes: number; enhancements: number; engravings: number }): boolean {
  return totals.runes > 0 && totals.enhancements === 0 && totals.engravings > 0;
}
