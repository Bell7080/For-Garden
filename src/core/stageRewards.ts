import { sortByRewardPriority } from "../data/rewardPriority";
import type { Wallet } from "./gacha";
import type { RunePart, RuneRarity } from "./runes";
import type { BattleStageDef } from "./types";

/** 초회 클리어 보상 한 줄 — 치즈케이크까지 같은 모양으로 편 것. */
export type StageFirstClearReward =
  | { kind: "currency"; currency: keyof Wallet; amount: number }
  /** 결과판은 발급된 룬을 그대로 그리므로 등급을 넓게 받는다. 초회 표가 주는 것은 고급·희귀뿐이다. */
  | { kind: "rune"; rarity: RuneRarity; part: RunePart; trait?: boolean; /** 받은 뒤의 결과판만 갖는다 — 눌러서 그 룬의 쪽지를 연다. */ instanceId?: string };

/**
 * 그 관문의 **초회 클리어 보상 전부**를 화면에 서는 순서대로 편다.
 *
 * 노드 미리보기·결과판·서버 지급이 모두 이 한 목록을 읽는다 — 셋이 저마다 치즈케이크와 나머지를
 * 이어 붙이면 미리 보여 준 것과 실제로 받은 것이 갈린다. 순서는 자주 쓰는 재화 → 드문 것이다.
 */
export function stageFirstClearRewards(stage: Pick<BattleStageDef, "rewards">): StageFirstClearReward[] {
  const rewards: StageFirstClearReward[] = [];
  if (stage.rewards.firstClearCheesecake > 0) rewards.push({ kind: "currency", currency: "cheesecake", amount: stage.rewards.firstClearCheesecake });
  for (const bonus of stage.rewards.firstClearBonus ?? []) {
    if (bonus.kind === "rune" || bonus.amount > 0) rewards.push(bonus);
  }
  // 순서는 보상 중요도 표가 정한다 — 미리보기·결과판·서버 지급이 모두 이 목록을 읽는다.
  return sortByRewardPriority(rewards, (reward) => reward.kind === "rune" ? "rune" : reward.currency);
}
