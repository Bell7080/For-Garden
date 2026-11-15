import { RELICS } from "../data/relics";
import { ALL_STORY_STAGES } from "../data/stages";
import { BOUNTY_TIERS } from "../data/bounty";
import { CAKE_OPERATION_ENEMY_IDS } from "../data/cakeOperation";
import { isBountyTierCleared } from "./bountyRun";
import type { MissionReward } from "./missions";
import type { RelicDef } from "./types";
type Rarity = RelicDef["rarity"];
import type { Session } from "../state/session";

/**
 * 도감(조우 기록)의 순수 규칙 — 무엇이 기록되었나, 기록 점수가 몇인가, 어느 마디의 젬을 받을 수 있나.
 *
 * **기록은 「마주한 적이 있다」 하나다.** 함께 싸운 아군(보유)과 전장에서 맞선 적이 모두 든다 — 이긴 판만이
 * 아니라 진 판에서 본 얼굴도 남는다. 상태가 이미 말하는 것(보유 · 깬 관문 · 깬 던전 단계 · 원정 기록)은 상태에서
 * 읽고, 상태에 남지 않는 만남(진 판 · 레이드 보스 · 지층)만 저장 경계가 `AchievementState.encountered`에 굳힌다.
 * 그래서 도감을 늦게 들였어도 이제껏 만난 만큼이 그대로 선다.
 *
 * 귀속 소환수(쿠로·시로·디모)는 주인의 몸이라 따로 칸을 두지 않는다.
 */

export type CodexSide = "ally" | "enemy";

/** 도감에 칸이 서는 개체 — 정의 순서 그대로다. */
export const CODEX_RELICS: readonly RelicDef[] = RELICS.filter((relic) => relic.summonOnly !== true);
const CODEX_IDS: ReadonlySet<string> = new Set(CODEX_RELICS.map(({ id }) => id));

export function isCodexRelicId(id: string): boolean { return CODEX_IDS.has(id); }

/** 적 전용 개체는 「적」 쪽, 나머지(뽑을 수 있는 렐릭)는 「아군」 쪽에 선다 — 적으로 먼저 만났어도 아군 칸이다. */
export function codexSide(relic: RelicDef): CodexSide { return relic.enemyOnly === true ? "enemy" : "ally"; }

/** 한 칸이 올리는 기록 점수. 귀한 개체일수록 한 번 만난 무게가 크다. */
export const CODEX_RARITY_POINTS: Readonly<Record<Rarity, number>> = { R: 10, SR: 20, SSR: 30 };

/**
 * 기록 점수 마디와 그 젬. **한 번씩만 받는 덤**이라 반복 보상 승인선 밖이지만 업적처럼 예산 띠 안에 둔다
 * (`CODEX_GEM_BUDGET`). 지금 개체 53종이 다 차면 1,090점이고, 그 위 마디는 개체가 늘 때 열린다.
 */
export const CODEX_MILESTONES: readonly { score: number; reward: MissionReward }[] = [
  { score: 50, reward: { currency: "gems", amount: 50 } },
  { score: 100, reward: { currency: "gems", amount: 50 } },
  { score: 150, reward: { currency: "gems", amount: 50 } },
  { score: 200, reward: { currency: "gems", amount: 100 } },
  { score: 300, reward: { currency: "gems", amount: 100 } },
  { score: 400, reward: { currency: "gems", amount: 100 } },
  { score: 500, reward: { currency: "gems", amount: 150 } },
  { score: 600, reward: { currency: "gems", amount: 150 } },
  { score: 700, reward: { currency: "gems", amount: 150 } },
  { score: 800, reward: { currency: "gems", amount: 200 } },
  { score: 900, reward: { currency: "gems", amount: 200 } },
  { score: 1000, reward: { currency: "gems", amount: 200 } },
];

/** 도감 마디의 젬 합 상한 — 업적(3,000)의 절반이다. 마디를 더하거나 값을 올리면 이 값부터 다시 잰다(응태 승인). */
export const CODEX_GEM_BUDGET = 1500;

/** 상태가 이미 말하는 만남 — 보유, 깬 스토리 관문(난이도 전부), 깬 현상수배·대작전 단계, 원정 기록. */
export function derivedCodexEncounters(state: Pick<Session, "owned" | "cleared" | "bounty" | "cakeOperation" | "expedition">): Set<string> {
  const ids = new Set<string>();
  for (const id of state.owned) ids.add(id);
  for (const stage of ALL_STORY_STAGES) {
    if (stage.kind !== "battle" || !state.cleared.has(stage.id)) continue;
    for (const enemy of stage.enemies) ids.add(enemy.relicId);
  }
  const bountyCleared = state.bounty?.clearedTierIds ?? [];
  for (const tier of BOUNTY_TIERS) if (isBountyTierCleared(tier, bountyCleared)) for (const round of tier.rounds) ids.add(round.relicId);
  if ((state.cakeOperation?.clearedIndex ?? -1) >= 0) for (const id of CAKE_OPERATION_ENEMY_IDS) ids.add(id);
  if ((state.expedition?.allTimeBestScore ?? 0) > 0 || (state.expedition?.bestScore ?? 0) > 0) ids.add("pontos");
  for (const id of [...ids]) if (!CODEX_IDS.has(id)) ids.delete(id);
  return ids;
}

/** 기록된 개체 — 저장에 굳힌 만남과 상태가 말하는 만남의 합. */
export function codexRecordedIds(state: Pick<Session, "owned" | "cleared" | "bounty" | "cakeOperation" | "expedition" | "achievements">): Set<string> {
  const ids = derivedCodexEncounters(state);
  for (const id of state.achievements?.encountered ?? []) if (CODEX_IDS.has(id)) ids.add(id);
  return ids;
}

export function codexScore(recorded: ReadonlySet<string>): number {
  return CODEX_RELICS.reduce((sum, relic) => sum + (recorded.has(relic.id) ? CODEX_RARITY_POINTS[relic.rarity] : 0), 0);
}

export function codexMaxScore(): number {
  return CODEX_RELICS.reduce((sum, relic) => sum + CODEX_RARITY_POINTS[relic.rarity], 0);
}

/** 그 점수로 닿은 마디 수(앞에서부터 이어지는 만큼). */
export function codexReachedMilestones(score: number): number {
  let count = 0;
  for (const milestone of CODEX_MILESTONES) { if (score < milestone.score) break; count += 1; }
  return count;
}

export function codexClaimableCount(score: number, claimed: number): number {
  return Math.max(0, codexReachedMilestones(score) - claimed);
}

/** 닿았지만 받지 않은 마디를 **차례대로 모두** 걷는다. */
export function claimCodexMilestones(score: number, claimed: number): { claimed: number; indices: number[]; rewards: MissionReward[] } {
  const reached = codexReachedMilestones(score);
  const indices: number[] = [];
  const totals = new Map<MissionReward["currency"], number>();
  for (let index = claimed; index < reached; index += 1) {
    indices.push(index);
    const { currency, amount } = CODEX_MILESTONES[index].reward;
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return { claimed: Math.max(claimed, reached), indices, rewards: [...totals].map(([currency, amount]) => ({ currency, amount })) };
}

/** 새로 굳힐 만남을 더한 기록 목록 — 칸이 없는 ID는 버리고 순서는 도감 순서를 따른다. */
export function mergeEncountered(current: readonly string[] | undefined, add: Iterable<string>): string[] {
  const set = new Set((current ?? []).filter((id) => CODEX_IDS.has(id)));
  for (const id of add) if (CODEX_IDS.has(id)) set.add(id);
  return CODEX_RELICS.filter(({ id }) => set.has(id)).map(({ id }) => id);
}
