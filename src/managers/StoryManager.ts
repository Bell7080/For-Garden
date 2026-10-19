import { GameApiError, type ApplyStoryEffectRequest } from "../api/contracts";
import { resolveStoryChoice, storyDefinition } from "../api/storyAuthority";
import { hasRemoteState } from "../api/resultState";
import type { Wallet } from "../core/gacha";
import type { DialogueEffect } from "../core/dialogue";
import { session, type Session } from "../state/session";
import { resolveServerApi, type RecordApi } from "./serverApi";

/** 이야기 완료 영수증. */
export interface StoryCompletionReceipt { firstCompletion: boolean; gemsGranted: number; wallet?: Wallet; }

/**
 * 대사 선택 명령과 이야기 완료 기록을 서버에 보내는 경계다. 대상·범위·재관람 중복 검증은 서버가 한다.
 *
 * 한 장면 안의 선택 효과와 완료는 **보낸 순서대로** 서버에 닿아야 한다(완료가 먼저 닿으면 그 뒤의 효과는
 * 재관람으로 읽혀 보상이 사라진다). 그래서 이 매니저의 서버 호출은 하나의 줄로 직렬화한다.
 */
export class StoryManager {
  private readonly apiCache: { api?: RecordApi } = {};
  private tail: Promise<unknown> = Promise.resolve();
  private readonly pending = new Map<string, Map<string, ApplyStoryEffectRequest>>();
  private pendingOwner?: string;

  private prepareOwner(): string {
    const owner = this.state.playerCard.uid;
    if (this.pendingOwner !== owner) { this.pending.clear(); this.pendingOwner = owner; }
    return owner;
  }
  constructor(private readonly state: Session = session, private readonly injectedApi?: RecordApi) {}

  private get api(): RecordApi { return resolveServerApi<RecordApi>(this.state, this.injectedApi, this.apiCache); }

  /** 앞선 호출이 실패해도 줄은 끊기지 않는다. 호출한 쪽은 자기 몫의 실패만 받는다. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job, job);
    this.tail = run.catch(() => undefined);
    return run;
  }

  isCompleted(storyId: string): boolean { return this.state.completedStoryIds.has(storyId); }

  /** 화면은 식별자만 보낸다. 실패한 선택은 완료 전에 같은 명령으로 다시 저장한다. */
  applyChoice(storyId: string, nodeId: string, choiceId: string): Promise<number> {
    const owner = this.prepareOwner();
    if (this.isCompleted(storyId)) return Promise.resolve(0);
    const request = { storyId, nodeId, choiceId };
    const key = JSON.stringify([nodeId, choiceId]);
    let choices = this.pending.get(storyId);
    if (!choices) { choices = new Map(); this.pending.set(storyId, choices); }
    choices.set(key, request);
    return this.enqueue(async () => {
      if (owner !== this.state.playerCard.uid) throw new GameApiError("INVALID_STATE", "계정이 변경되었습니다.");
      const response = await this.api.applyStoryEffect(request);
      choices.delete(key);
      return response.xpGained;
    });
  }

  /** 기존 호출부도 임의 효과를 보내지 않고 카탈로그의 선택 ID로 바꾼다. */
  applyEffect(storyId: string, effect: DialogueEffect): Promise<number> {
    if (this.isCompleted(storyId)) return Promise.resolve(0);
    try {
      const { node, choice } = resolveStoryChoice(storyDefinition(storyId), { storyId, effect });
      return this.applyChoice(storyId, node.id, choice.id);
    } catch (error) { return Promise.reject(error); }
  }

  /** 처음 완료한 것이면 `true`다. 지금 줄에 선 효과가 모두 닿은 뒤에 서버가 기록한다. */
  complete(storyId: string): Promise<boolean> {
    return this.completeWithReceipt(storyId).then(({ firstCompletion }) => firstCompletion);
  }

  /** `complete`와 같되 이야기 서브가 처음 준 젬과 서버가 확정한 지갑도 함께 돌려준다. */
  completeWithReceipt(storyId: string): Promise<StoryCompletionReceipt> {
    const owner = this.prepareOwner();
    if (!storyId || this.isCompleted(storyId)) return Promise.resolve({ firstCompletion: false, gemsGranted: 0 });
    return this.enqueue(async () => {
      if (owner !== this.state.playerCard.uid) throw new GameApiError("INVALID_STATE", "계정이 변경되었습니다.");
      const choices = this.pending.get(storyId);
      for (const [key, request] of choices ?? []) {
        await this.api.applyStoryEffect(request);
        choices!.delete(key);
      }
      const response = await this.api.completeStory({ storyId });
      this.pending.delete(storyId);
      return { firstCompletion: response.firstCompletion, gemsGranted: response.gemsGranted ?? 0, ...(response.wallet && !hasRemoteState(response) ? { wallet: response.wallet } : {}) };
    });
  }
}

export const storyManager = new StoryManager();
