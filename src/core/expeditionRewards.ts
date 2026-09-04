import { EXPEDITION_AUGMENTS, getExpeditionAugment, type ExpeditionAugmentRarity } from "../data/expeditionAugments";
import type { ExpeditionNodeType } from "./expeditionMap";
import { EXPEDITION_COMBAT_REWARD_MULTIPLIERS, EXPEDITION_NODE_REWARD_BALANCE, EXPEDITION_TREASURE_REWARD_BALANCE } from "../data/expedition";

/** 서버가 런 상태에 더할 수 있는 정수 재화 결과다. */
export type ExpeditionNodeRewards = Partial<Record<keyof typeof EXPEDITION_NODE_REWARD_BALANCE, number>>;

/** 주입 난수를 범위의 양끝을 포함한 정수로 변환한다. */
function rollInteger(min: number, max: number, random: () => number): number {
  const normalized = Math.min(1 - Number.EPSILON, Math.max(0, random()));
  return min + Math.floor(normalized * (max - min + 1));
}

/**
 * 노드 종류·현재 런 누적량·서버 난수만으로 이번 보상을 계산하는 순수 규칙이다.
 * 잘못된 누적 재화는 조용히 무시하지 않고 거부해 서버 저장 오염을 드러낸다.
 */
export function calculateExpeditionNodeRewards(input: { nodeType: ExpeditionNodeType; accumulated: Readonly<Record<string, number>>; random: () => number }): ExpeditionNodeRewards {
  for (const [currency, amount] of Object.entries(input.accumulated)) {
    if (!(currency in EXPEDITION_NODE_REWARD_BALANCE) || !Number.isFinite(amount) || amount < 0) throw new Error("INVALID_EXPEDITION_REWARD_STATE");
  }
  if (input.nodeType === "rest" || input.nodeType === "boss") return {};
  const source = input.nodeType === "treasure"
    ? EXPEDITION_TREASURE_REWARD_BALANCE
    : Object.fromEntries(Object.entries(EXPEDITION_NODE_REWARD_BALANCE).map(([currency, rule]) => [currency, rule.perNode]));
  const multiplier = input.nodeType === "treasure" ? 1 : EXPEDITION_COMBAT_REWARD_MULTIPLIERS[input.nodeType];
  const result: ExpeditionNodeRewards = {};
  for (const [currency, range] of Object.entries(source)) {
    const key = currency as keyof typeof EXPEDITION_NODE_REWARD_BALANCE;
    const remaining = EXPEDITION_NODE_REWARD_BALANCE[key].runCap - (input.accumulated[key] ?? 0);
    const rolled = Math.floor(rollInteger(range.min, range.max, input.random) * multiplier);
    result[key] = Math.max(0, Math.min(remaining, rolled));
  }
  return result;
}

/**
 * 일반 노드 클리어 보상을 주간 랭킹 누적 점수로 환산한다.
 *
 * 불사 보스에게 입힌 피해량(수만 단위)에 비하면 한 노드의 재화(수십~수백 단위)는 작지만,
 * 전투 한 번의 노력을 조금이라도 누적 점수에 보태 주간 보상 단계(EXPEDITION_CUMULATIVE_REWARD_STAGES)에
 * 기여하게 한다. 재화 종류를 가중하지 않고 그대로 더해, 새 재화가 추가돼도 이 표를 다시 조정할
 * 필요가 없게 한다.
 */
export function expeditionNodeRewardScore(rewards: Readonly<Record<string, number>>): number {
  return Math.max(0, Math.floor(Object.values(rewards).reduce((sum, amount) => sum + amount, 0)));
}

/** 저장 가능한 증강 확정 결과다. 전체 증강에는 대상 ID를 두지 않는다. */
export interface ExpeditionAugmentSelection { augmentId: string; targetRelicId?: string }

/** 후보와 개인 증강에서 고를 수 있는 유효 대상을 함께 고정해 재접속 때 재계산하지 않는다. */
export interface ExpeditionAugmentOffer { augmentId: string; eligibleTargetRelicIds: string[] }

/** 런 HP 스냅샷에서 후보 적용 가능성을 판단하는 데 필요한 최소 필드다. */
export interface ExpeditionRewardRelic { relicId: string; currentHp: number; alive: boolean }

/** 노드별 선택 횟수와 풀이다. 휴식·보물은 의도적으로 0회이며 보스도 일반 증강을 주지 않는다. */
export function expeditionRewardRule(nodeType: ExpeditionNodeType): { selections: number; rarity: ExpeditionAugmentRarity | null } {
  if (nodeType === "normal") return { selections: 1, rarity: "sr" };
  if (nodeType === "horde") return { selections: 2, rarity: "sr" };
  if (nodeType === "elite") return { selections: 1, rarity: "ssr" };
  return { selections: 0, rarity: null };
}

/** 생존자가 한 기라도 있으면 사망자는 휴식에서 부활 가능하므로 개인 증강 대상에 남는다. */
export function eligibleExpeditionTargets(relics: readonly ExpeditionRewardRelic[]): string[] {
  if (!relics.some(({ alive, currentHp }) => alive && currentHp > 0)) return [];
  return relics.filter(({ alive, currentHp }) => alive || currentHp === 0).map(({ relicId }) => relicId);
}

/** 저장 선택을 세어 최대 중첩 및 이미 점유한 배타 그룹을 판정한다. */
function augmentAvailable(augmentId: string, prior: readonly ExpeditionAugmentSelection[]): boolean {
  const def = getExpeditionAugment(augmentId);
  if (!def) return false;
  const stackCount = prior.filter((selection) => selection.augmentId === def.id).length;
  if (stackCount >= def.maxStacks) return false;
  if (!def.exclusiveGroup) return true;
  // 같은 증강의 허용 중첩은 유지하되, 그룹의 다른 증강을 먼저 골랐다면 후보를 닫는다.
  return !prior.some((selection) => {
    const selected = getExpeditionAugment(selection.augmentId);
    return selected !== undefined && selected.exclusiveGroup === def.exclusiveGroup && selected.id !== def.id;
  });
}

/** 한 선택의 후보를 중복 없이 뽑고, 운영 제한에 닿은 항목은 RNG 소비 전에 제거한다. */
export function generateExpeditionAugmentOffers(input: {
  rarity: ExpeditionAugmentRarity;
  relics: readonly ExpeditionRewardRelic[];
  selections: readonly ExpeditionAugmentSelection[];
  random: () => number;
  candidateCount?: number;
}): ExpeditionAugmentOffer[] {
  const targets = eligibleExpeditionTargets(input.relics);
  const pool = EXPEDITION_AUGMENTS.filter((def) => def.rarity === input.rarity
    && (def.target === "party" || targets.length > 0)
    && augmentAvailable(def.id, input.selections));
  // Fisher-Yates는 주입 RNG만 소비하므로 저장된 seed로 언제나 같은 제안을 복원할 수 있다.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const chosen = Math.floor(input.random() * (index + 1));
    [pool[index], pool[chosen]] = [pool[chosen], pool[index]];
  }
  // 풀이 요청 수보다 작으면 범용 더미를 만들지 않고 가능한 후보만 반환해 선택 화면을 계속 연다.
  const requestedCount = Math.max(0, Math.floor(input.candidateCount ?? 3));
  return pool.slice(0, requestedCount).map((def) => ({
    augmentId: def.id,
    eligibleTargetRelicIds: def.target === "relic" ? targets : [],
  }));
}

/** 서버/매니저 경계에서 제안 포함 여부뿐 아니라 현재 런의 운영 제한도 다시 검증한다. */
export function validateExpeditionAugmentChoice(offer: ExpeditionAugmentOffer, selection: ExpeditionAugmentSelection, prior: readonly ExpeditionAugmentSelection[]): boolean {
  const def = getExpeditionAugment(offer.augmentId);
  if (!def || selection.augmentId !== offer.augmentId || !augmentAvailable(def.id, prior)) return false;
  if (def.target === "party") return selection.targetRelicId === undefined;
  return selection.targetRelicId !== undefined && offer.eligibleTargetRelicIds.includes(selection.targetRelicId);
}

/** 문자열 seed를 저장할 수 있도록 만든 결정적 난수원이다. */
export function expeditionRewardRandom(seed: string): () => number {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => { value += 0x6d2b79f5; let next = value; next = Math.imul(next ^ next >>> 15, next | 1); next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; };
}
