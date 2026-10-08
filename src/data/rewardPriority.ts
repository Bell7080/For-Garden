/**
 * 보상 중요도 표 — **모든 보상 줄의 순서는 이 표 하나가 정한다.**
 *
 * 보상 팝업·구매 영수증·패키지 카드·패스·우편 첨부·초회 보상이 각자 순서를 정하던 때는 같은 묶음이
 * 화면마다 다른 순서로 서 토벌 증표가 치즈케이크보다 앞에 뜨기도 했다. 키는 지갑 키(`WalletItemKey`),
 * 가방 아이템 ID, 그리고 재화·아이템이 아닌 지급의 가상 키(`RewardPriorityVirtualKey`)다.
 *
 * 앞에 적을수록 먼저 선다. 같은 키끼리는 받은 순서를 지키고(안정 정렬), 표에 없는 키는 맨 뒤다.
 * 새 재화·아이템을 더하면 여기 한 줄을 더한다 — `tests/unit/rewardPriority.test.ts`가 지갑 키와
 * 가방 아이템이 모두 표에 있는지 지킨다.
 */
export type RewardPriorityVirtualKey = "relicFragment" | "rune" | "profileDecoration";

export const REWARD_PRIORITY: readonly string[] = [
  // 핵심 재화
  "gems", "fossil", "amber", "gold", "cheesecake",
  // 성장 재료
  "restoration-crystal", "refined-core", "ancient-core", "rune-dust",
  // 행동력
  "stamina-tonic-large", "stamina-tonic", "stamina",
  // 입장권
  "strata-ticket", "sweep-ticket", "duel-ticket", "raid-select-ticket", "raid-ticket",
  // 보조 재화
  "rawStone", "dnaFragments",
  // 콘텐츠 전리품 증표 — 쓰는 곳이 한정되어 후순위다
  "duelEmblem", "raidSigil", "salvageRecord",
  // 단품 — 파편·룬·장식은 재화가 아니라 한 점씩 받는 물건이라 가장 마지막이다
  "relicFragment", "rune", "profileDecoration",
];

const RANK: ReadonlyMap<string, number> = new Map(REWARD_PRIORITY.map((key, index) => [key, index]));

/** 표 순위. 표에 없는 키는 모든 키 뒤다. */
export function rewardRank(key: string): number {
  return RANK.get(key) ?? REWARD_PRIORITY.length;
}

/** 보상 목록을 중요도 순으로 세운 새 배열. 같은 순위끼리는 원래 순서를 지킨다. */
export function sortByRewardPriority<T>(list: readonly T[], keyOf: (entry: T) => string): T[] {
  return list.map((entry, index) => ({ entry, index, rank: rewardRank(keyOf(entry)) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ entry }) => entry);
}
