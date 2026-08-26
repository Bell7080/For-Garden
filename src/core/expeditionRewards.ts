import { EXPEDITION_AUGMENTS, type ExpeditionAugmentDef, type ExpeditionAugmentRarity } from "../data/expeditionAugments";
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

/** 저장 가능한 증강 확정 결과다. 전체 증강에는 대상 ID를 두지 않는다. */
export interface ExpeditionAugmentSelection { augmentId: string; targetRelicId?: string }

/** 후보와 개인 증강에서 고를 수 있는 유효 대상을 함께 고정해 재접속 때 재계산하지 않는다. */
export interface ExpeditionAugmentOffer { augmentId: string; eligibleTargetRelicIds: string[] }

/** 런 HP 스냅샷에서 후보 적용 가능성을 판단하는 데 필요한 최소 필드다. */
export interface ExpeditionRewardRelic { relicId: string; currentHp: number; alive: boolean }

/** 노드별 선택 횟수와 풀이다. 휴식·보물은 의도적으로 0회이며 보스도 일반 증강을 주지 않는다. */
export function expeditionRewardRule(nodeType: ExpeditionNodeType): { selections: number; rarity: ExpeditionAugmentRarity | null } {
  if (nodeType === "normal") return { selections: 1, rarity: "common" };
  if (nodeType === "horde") return { selections: 2, rarity: "common" };
  if (nodeType === "elite") return { selections: 1, rarity: "advanced" };
  return { selections: 0, rarity: null };
}

/** 생존자가 한 기라도 있으면 사망자는 휴식에서 부활 가능하므로 개인 증강 대상에 남는다. */
export function eligibleExpeditionTargets(relics: readonly ExpeditionRewardRelic[]): string[] {
  if (!relics.some(({ alive, currentHp }) => alive && currentHp > 0)) return [];
  return relics.filter(({ alive, currentHp }) => alive || currentHp === 0).map(({ relicId }) => relicId);
}

/** 같은 증강/대상 조합이 최대 중첩에 닿았는지 검사한다. */
function hasCapacity(def: ExpeditionAugmentDef, selections: readonly ExpeditionAugmentSelection[], targetRelicId?: string): boolean {
  const count = selections.filter((selection) => selection.augmentId === def.id && (def.target === "party" || selection.targetRelicId === targetRelicId)).length;
  return count < def.maxStacks;
}

/** 한 선택의 후보를 중복 없이 뽑고, 적용 가능한 개인 대상이 하나도 없는 후보는 제외한다. */
export function generateExpeditionAugmentOffers(input: {
  rarity: ExpeditionAugmentRarity;
  relics: readonly ExpeditionRewardRelic[];
  selections: readonly ExpeditionAugmentSelection[];
  random: () => number;
  candidateCount?: number;
}): ExpeditionAugmentOffer[] {
  const targets = eligibleExpeditionTargets(input.relics);
  const pool = EXPEDITION_AUGMENTS.filter((def) => def.rarity === input.rarity && (def.target === "party"
    ? hasCapacity(def, input.selections)
    : targets.some((target) => hasCapacity(def, input.selections, target))));
  // Fisher-Yates는 주입 RNG만 소비하므로 저장된 seed로 언제나 같은 제안을 복원할 수 있다.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const chosen = Math.floor(input.random() * (index + 1));
    [pool[index], pool[chosen]] = [pool[chosen], pool[index]];
  }
  return pool.slice(0, input.candidateCount ?? 3).map((def) => ({
    augmentId: def.id,
    eligibleTargetRelicIds: def.target === "relic" ? targets.filter((target) => hasCapacity(def, input.selections, target)) : [],
  }));
}

/** 선택 요청이 실제 제안과 대상/중첩 규칙을 모두 만족하는지 순수하게 검증한다. */
export function validateExpeditionAugmentChoice(offer: ExpeditionAugmentOffer, selection: ExpeditionAugmentSelection, prior: readonly ExpeditionAugmentSelection[]): boolean {
  const def = EXPEDITION_AUGMENTS.find(({ id }) => id === offer.augmentId);
  if (!def || selection.augmentId !== offer.augmentId) return false;
  if (def.target === "party") return selection.targetRelicId === undefined && hasCapacity(def, prior);
  return selection.targetRelicId !== undefined && offer.eligibleTargetRelicIds.includes(selection.targetRelicId) && hasCapacity(def, prior, selection.targetRelicId);
}

/** 문자열 seed를 저장할 수 있도록 만든 결정적 난수원이다. */
export function expeditionRewardRandom(seed: string): () => number {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => { value += 0x6d2b79f5; let next = value; next = Math.imul(next ^ next >>> 15, next | 1); next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; };
}
