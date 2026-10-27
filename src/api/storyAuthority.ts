import type { DialogueChoice, DialogueNode, DialogueStory } from "../core/dialogue";
import { grantBondXp, BOND_TOTAL_XP_BY_LEVEL, BOND_LEVEL_CAP } from "../core/bond";
import { isStageUnlockedByProgress } from "../core/stageProgress";
import { emptyServerJournal } from "../core/serverJournal";
import { getRecollectionStory } from "../data/dialogues/recollections";
import { INTERACTION_JOURNALS } from "../data/interactionJournals";
import { STAGE_STORY_LINKS } from "../data/stageStories";
import { STAGES } from "../data/stages";
import { PLAYABLE_RELICS } from "../data/relics";
import type { Session } from "../state/session";
import { GameApiError, type ApplyStoryEffectRequest } from "./contracts";

/** 본문과 같은 카탈로그만 신뢰한다. 원격 명령으로 이야기·보상 수치를 새로 만들 수 없다. */
export function storyDefinition(storyId: string): DialogueStory {
  const journal = INTERACTION_JOURNALS.find(entry => entry.dialogueStory?.id === storyId);
  if (journal?.dialogueStory) return journal.dialogueStory;
  try { return getRecollectionStory(storyId); }
  catch { throw new GameApiError("INVALID_STATE", "알 수 없는 이야기입니다."); }
}

export function assertStoryUnlocked(state: Session, storyId: string): DialogueStory {
  const story = storyDefinition(storyId);
  const completed = new Set(state.cleared);
  for (const stage of STAGES) if (stage.kind === "story" && state.completedStoryIds.has(stage.storyId)) completed.add(stage.id);
  const sub = STAGES.find(stage => stage.kind === "story" && stage.storyId === storyId);
  const linked = Object.entries(STAGE_STORY_LINKS).find(([, link]) => link.pre === storyId || link.post === storyId);
  const bond = /^bond\.([^.]+)\.(\d+)$/.exec(storyId);
  const journal = INTERACTION_JOURNALS.find(entry => entry.dialogueStory?.id === storyId);
  const locked = sub ? !isStageUnlockedByProgress(STAGES, sub.id, completed)
    : linked ? linked[1].post === storyId ? !state.cleared.has(linked[0]) : !isStageUnlockedByProgress(STAGES, linked[0], completed)
    : bond ? !state.owned.has(bond[1]) || (state.relicProgress[bond[1]]?.bondLevel ?? 0) < Number(bond[2])
    : journal ? !state.discoveredInteractionJournalIds.has(journal.id) : false;
  if (locked) throw new GameApiError("INVALID_STATE", "아직 열리지 않은 이야기입니다.");
  return story;
}

/** 새 클라이언트는 선택 ID만 보낸다. 구형 effect 요청도 카탈로그의 단 하나와 정확히 일치해야 한다. */
export function resolveStoryChoice(story: DialogueStory, request: ApplyStoryEffectRequest): { node: DialogueNode; choice: DialogueChoice } {
  const sameEffect = (choice: DialogueChoice): boolean => Boolean(choice.effect && request.effect
    && choice.effect.type === request.effect.type && choice.effect.relicId === request.effect.relicId && choice.effect.amount === request.effect.amount);
  const choices = story.nodes.flatMap(node => (node.choices ?? []).map(choice => ({ node, choice })));
  const matches = request.nodeId !== undefined || request.choiceId !== undefined
    ? choices.filter(({ node, choice }) => node.id === request.nodeId && choice.id === request.choiceId && (!request.effect || sameEffect(choice)))
    : choices.filter(({ choice }) => sameEffect(choice));
  if (matches.length !== 1) throw new GameApiError("INVALID_STATE", "이야기에 없는 선택 효과입니다.");
  const found = matches[0];
  if (found.choice.effect && (!PLAYABLE_RELICS.some(relic => relic.id === found.choice.effect!.relicId)
    || !Number.isInteger(found.choice.effect.amount) || found.choice.effect.amount < 0 || found.choice.effect.amount > 20)) {
    throw new GameApiError("INVALID_STATE", "대사 효과 대상 또는 보상이 올바르지 않습니다.");
  }
  return found;
}

/** 앞서 고른 분기를 따라 실제로 도달할 수 있는 선택지만 허용한다. */
export function assertStoryChoiceReachable(story: DialogueStory, selected: Record<string, string>, target: string): void {
  let id: string | undefined = story.startNodeId;
  const visited = new Set<string>();
  while (id && !visited.has(id)) {
    visited.add(id);
    const node = story.nodes.find(node => node.id === id);
    if (!node) break;
    if (node.id === target) return;
    id = node.choices?.length ? node.choices.find(choice => choice.id === selected[node.id])?.nextId : node.nextId;
  }
  throw new GameApiError("INVALID_STATE", "도달하지 않은 이야기 선택지입니다.");
}

/** 모든 최초 획득 경로가 같은 저장 안에서 적립분을 지급·제거한다. next는 호출자가 만든 복제본이다. */
export function redeemDeferredStoryBond(next: Session, acquired: readonly string[]): void {
  const pending = next.serverJournal?.pendingStoryBondXp;
  if (!pending || !acquired.some(id => (pending[id] ?? 0) > 0)) return;
  const journal = structuredClone(next.serverJournal ?? emptyServerJournal());
  for (const id of new Set(acquired)) {
    const amount = journal.pendingStoryBondXp?.[id] ?? 0;
    if (!amount || !next.owned.has(id) || !next.relicProgress[id]) continue;
    next.relicProgress[id] = grantBondXp(next.relicProgress[id], Math.min(amount, BOND_TOTAL_XP_BY_LEVEL[BOND_LEVEL_CAP])).progress;
    delete journal.pendingStoryBondXp![id];
  }
  next.serverJournal = journal;
}
