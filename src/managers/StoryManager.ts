import type { DialogueEffect } from "../core/dialogue";
import { session, type Session } from "../state/session";
import { resolveServerApi, type RecordApi } from "./serverApi";

/**
 * 대사 선택 명령과 이야기 완료 기록을 서버에 보내는 경계다. 대상·범위·재관람 중복 검증은 서버가 한다.
 *
 * 한 장면 안의 선택 효과와 완료는 **보낸 순서대로** 서버에 닿아야 한다(완료가 먼저 닿으면 그 뒤의 효과는
 * 재관람으로 읽혀 보상이 사라진다). 그래서 이 매니저의 서버 호출은 하나의 줄로 직렬화한다.
 */
export class StoryManager {
  private readonly apiCache: { api?: RecordApi } = {};
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly state: Session = session, private readonly injectedApi?: RecordApi) {}

  private get api(): RecordApi { return resolveServerApi<RecordApi>(this.state, this.injectedApi, this.apiCache); }

  /** 앞선 호출이 실패해도 줄은 끊기지 않는다. 호출한 쪽은 자기 몫의 실패만 받는다. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job, job);
    this.tail = run.catch(() => undefined);
    return run;
  }

  isCompleted(storyId: string): boolean { return this.state.completedStoryIds.has(storyId); }

  /** 회상에서는 선택 결과를 보여 주되 서버가 보상을 다시 지급하지 않는다. */
  applyEffect(storyId: string, effect: DialogueEffect): Promise<number> {
    if (this.isCompleted(storyId)) return Promise.resolve(0);
    return this.enqueue(async () => (await this.api.applyStoryEffect({ storyId, effect })).xpGained);
  }

  /** 처음 완료한 것이면 `true`다. 지금 줄에 선 효과가 모두 닿은 뒤에 서버가 기록한다. */
  complete(storyId: string): Promise<boolean> {
    if (!storyId || this.isCompleted(storyId)) return Promise.resolve(false);
    return this.enqueue(async () => (await this.api.completeStory({ storyId })).firstCompletion);
  }
}

export const storyManager = new StoryManager();
