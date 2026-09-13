import type { RelicDef, RelicRarity } from "./types";

/**
 * 도감 정렬 — 기준과 **방향**.
 *
 * 방향을 따로 가르는 이유는, 세 기준이 물어보는 것이 서로 다른 축이기 때문이다. 개체번호는
 * 세는 수이고 희귀도와 전투력은 **높을수록 앞에 오고 싶은** 값이라, 처음 보여 주는 방향이
 * 기준마다 다르다(`SORT_DEFAULT_DESCENDING`). 화살표의 뜻은 어느 기준에서나 하나다 —
 * **아래가 큰 값 먼저, 위가 작은 값 먼저**다.
 *
 * 순수 모듈에 두는 이유는 씬과 회귀 테스트가 같은 순서를 읽어야 하기 때문이다.
 */
export type RelicSortMode = "number" | "rarity" | "power";

export const RELIC_SORT_MODES: readonly RelicSortMode[] = ["number", "rarity", "power"];

/**
 * 기준마다 처음 보여 주는 방향.
 *
 * 번호만 오름차순이다 — 도감을 열었을 때 001부터 서는 것이 목록의 기본값이고, 귀한 것과 센
 * 것은 위에 모여야 훑을 이유가 생긴다.
 */
export const SORT_DEFAULT_DESCENDING: Readonly<Record<RelicSortMode, boolean>> = {
  number: false,
  rarity: true,
  power: true,
};

/** 희귀도의 **오름차순** 서열. R이 가장 작고 SSR이 가장 크다. */
const RARITY_RANK: Readonly<Record<RelicRarity, number>> = { R: 0, SR: 1, SSR: 2 };

/**
 * 한 기준의 **오름차순** 비교. 동점을 끊는 몫은 여기 넣지 않는다.
 *
 * 동점 처리를 이 안에 섞으면 방향을 뒤집을 때 그 몫까지 함께 뒤집혀, 전투력이 같은 두 개체가
 * 방향을 바꿀 때마다 자리를 맞바꾼다. 끊는 일은 부르는 쪽이 방향과 무관하게 한 번 더 한다.
 */
function ascendingCompare(mode: RelicSortMode, powerOf: (relic: RelicDef) => number): (a: RelicDef, b: RelicDef) => number {
  if (mode === "rarity") return (a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity];
  if (mode === "power") return (a, b) => powerOf(a) - powerOf(b);
  return (a, b) => a.specimenNumber.localeCompare(b.specimenNumber);
}

/**
 * 기준과 방향대로 줄을 세운다.
 *
 * 이미 정렬된 목록을 뒤집지 않고 **비교를 뒤집는다.** 뒤집으면 동점끼리의 순서까지 함께
 * 뒤집혀, 목록을 뒤집었다 되돌렸을 때 원래 자리로 돌아오지 않는다. 동점은 어느 방향에서나
 * **개체번호 오름차순**으로 끊는다 — 번호는 유일하므로 줄이 흔들릴 자리가 남지 않는다.
 */
export function sortRelicsBy(
  catalog: readonly RelicDef[],
  mode: RelicSortMode,
  descending: boolean,
  powerOf: (relic: RelicDef) => number,
): RelicDef[] {
  const compare = ascendingCompare(mode, powerOf);
  return [...catalog].sort((a, b) => {
    const order = compare(a, b);
    if (order !== 0) return descending ? -order : order;
    return a.specimenNumber.localeCompare(b.specimenNumber);
  });
}
