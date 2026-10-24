import { RELICS } from "../data/relics";
import { RETIRED_EXPEDITION_AUGMENTS } from "../data/expeditionTagAugments";
import { EXPEDITION_AUGMENTS, getExpeditionAugment, type ExpeditionAugmentRarity, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import type { ExpeditionNodeType } from "./expeditionMap";
import { EXPEDITION_COMBAT_REWARD_MULTIPLIERS, EXPEDITION_NODE_REWARD_BALANCE, EXPEDITION_TREASURE_REWARD_BALANCE, expeditionBossSalvage } from "../data/expedition";

/** 서버가 런 상태에 더할 수 있는 정수 재화 결과다. */
export type ExpeditionNodeRewards = Partial<Record<keyof typeof EXPEDITION_NODE_REWARD_BALANCE, number>>;

/**
 * 상향 기간에 만들어진 미정산 런도 현행 한 판 상한을 넘겨 지급하지 않는다.
 * 인양 기록만 노드 상한과 이미 확정된 폰토스 피해 몫을 함께 가질 수 있다.
 */
export function normalizeExpeditionPendingRewards(
  pending: Readonly<Record<string, number>>,
  bossDamageScore = 0,
): ExpeditionNodeRewards {
  const normalized: ExpeditionNodeRewards = {};
  for (const [currency, rule] of Object.entries(EXPEDITION_NODE_REWARD_BALANCE)) {
    const key = currency as keyof typeof EXPEDITION_NODE_REWARD_BALANCE;
    const raw = pending[key] ?? 0;
    const cap = rule.runCap + (key === "salvageRecord" ? expeditionBossSalvage(bossDamageScore) : 0);
    const amount = Math.max(0, Math.min(cap, Math.floor(Number.isFinite(raw) ? raw : 0)));
    if (amount > 0) normalized[key] = amount;
  }
  return normalized;
}

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

/** 한 판 점수의 두 독립 구성 요소와 합계를 함께 노출해 재화 보상과 점수를 혼동하지 않게 한다. */
export interface ExpeditionRunScore {
  /** 보스 전까지 확정된 일반 전투 노드 점수의 합이다. */
  normalNodeScoreTotal: number;
  /** 폰토스 전투에서 서버가 행동 재현으로 확정한 피해 점수다. */
  bossDamageScore: number;
  /** 한 판 점수 = 일반 노드 누적 점수 + 폰토스 피해 점수다. */
  runScore: number;
}

/** 서버·매니저·정산이 공유하는 유일한 한 판 합산식이다. */
export function calculateExpeditionRunScore(input: { normalNodeScoreTotal: number; bossDamageScore: number }): ExpeditionRunScore {
  const normalNodeScoreTotal = Math.max(0, Math.floor(input.normalNodeScoreTotal));
  const bossDamageScore = Math.max(0, Math.floor(input.bossDamageScore));
  return { normalNodeScoreTotal, bossDamageScore, runScore: normalNodeScoreTotal + bossDamageScore };
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

/** 적중이 없는 회복·지원 궁극기에는 적중형 증강을 잘못 배정하지 않는다. */
function supportsExpeditionAugment(def: ExpeditionAugmentDef, relicId: string): boolean {
  if (def.effect.kind !== "triggered" || def.effect.trigger !== "onUltimateHit") return true;
  const ultimate = RELICS.find(relic => relic.id === relicId)?.ultimate;
  return ultimate !== undefined && ultimate.damageType !== undefined && ultimate.power !== undefined && ultimate.power > 0;
}

/** 저장 선택을 세어 최대 중첩 및 이미 점유한 배타 그룹을 판정한다. */
function augmentAvailable(augmentId: string, prior: readonly ExpeditionAugmentSelection[]): boolean {
  const def = getExpeditionAugment(augmentId);
  if (!def) return false;
  // 겹치지 않는 개인 증강은 렐릭마다 한 번이라 런 전체 횟수로 세지 않는다 — 남은 대상은 `augmentTargets`가 가른다.
  const perRelic = def.target === "relic" && def.stacking.mode === "strongest";
  const stackCount = prior.filter((selection) => selection.augmentId === def.id).length;
  if (!perRelic && stackCount >= def.maxStacks) return false;
  if (!def.exclusiveGroup) return true;
  // 같은 증강의 허용 중첩은 유지하되, 그룹의 다른 증강을 먼저 골랐다면 후보를 닫는다.
  return !prior.some((selection) => {
    const selected = getExpeditionAugment(selection.augmentId);
    return selected !== undefined && selected.exclusiveGroup === def.exclusiveGroup && selected.id !== def.id;
  });
}

/**
 * 겹쳐도 더 세지지 않는 개인 증강(`strongest` — 치명타 시 출혈 같은 "한 번 먹이면 끝")을 이미 가진 렐릭은
 * 그 증강의 대상에서 뺀다. 남는 대상이 없으면 그 증강은 후보 풀에서 RNG 소비 전에 사라진다 — 셋 모두에게
 * 먹인 뒤에 고르면 아무 일도 하지 않는 퇴물 선택지가 나오지 않게.
 */
function augmentTargets(def: ExpeditionAugmentDef, targets: readonly string[], prior: readonly ExpeditionAugmentSelection[]): string[] {
  if (def.target !== "relic") return [];
  if (def.stacking.mode !== "strongest") return [...targets];
  const holders = new Set(prior.filter((selection) => selection.augmentId === def.id).map(({ targetRelicId }) => targetRelicId));
  return targets.filter((relicId) => !holders.has(relicId));
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
  const targetsFor = (def: ExpeditionAugmentDef) => augmentTargets(def, targets, input.selections).filter(id => supportsExpeditionAugment(def, id));
  const pool = EXPEDITION_AUGMENTS.filter((def) => def.rarity === input.rarity && !RETIRED_EXPEDITION_AUGMENTS.has(def.id)
    && (def.target === "party" || targetsFor(def).length > 0)
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
    eligibleTargetRelicIds: def.target === "relic" ? targetsFor(def) : [],
  }));
}

/** 서버/매니저 경계에서 제안 포함 여부뿐 아니라 현재 런의 운영 제한도 다시 검증한다. */
export function validateExpeditionAugmentChoice(offer: ExpeditionAugmentOffer, selection: ExpeditionAugmentSelection, prior: readonly ExpeditionAugmentSelection[]): boolean {
  const def = getExpeditionAugment(offer.augmentId);
  if (!def || selection.augmentId !== offer.augmentId || !augmentAvailable(def.id, prior)) return false;
  if (def.target === "party") return selection.targetRelicId === undefined;
  return selection.targetRelicId !== undefined && offer.eligibleTargetRelicIds.includes(selection.targetRelicId)
    && !(def.stacking.mode === "strongest" && prior.some((held) => held.augmentId === def.id && held.targetRelicId === selection.targetRelicId))
    && supportsExpeditionAugment(def, selection.targetRelicId);
}

/** 문자열 seed를 저장할 수 있도록 만든 결정적 난수원이다. */
export function expeditionRewardRandom(seed: string): () => number {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => { value += 0x6d2b79f5; let next = value; next = Math.imul(next ^ next >>> 15, next | 1); next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; };
}
