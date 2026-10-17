import type { DialogueStory } from "../core/dialogue";
import { createObservationStory } from "../data/observations";
import { PLAYABLE_RELICS } from "../data/relics";
import { session, type ObservationRecord, type Session } from "../state/session";
import { resolveServerApi, type RecordApi } from "./serverApi";

/** 관찰 인터뷰의 조회와 완료 요청을 맡는다. 일일 한도·최초 보상·기록 저장은 서버가 한 처리로 확정한다. */
export class ObservationManager {
  private readonly apiCache: { api?: RecordApi } = {};
  constructor(private readonly state: Session = session, private readonly injectedApi?: RecordApi) {}

  private get api(): RecordApi { return resolveServerApi<RecordApi>(this.state, this.injectedApi, this.apiCache); }

  /** 재관람도 같은 정적 조합을 사용하므로 별도 회상 콘텐츠를 만들 필요가 없다. */
  storyFor(relicId: string, utcDate: string): DialogueStory {
    const relic = PLAYABLE_RELICS.find(({ id }) => id === relicId);
    if (!relic || !this.state.owned.has(relicId)) throw new RangeError("관찰 대상은 보유한 렐릭이어야 합니다.");
    return createObservationStory(relicId, relic.name, utcDate);
  }

  recordFor(relicId: string): readonly ObservationRecord[] {
    return this.state.observationRecords.filter((record) => record.relicId === relicId);
  }

  canStart(relicId: string, utcDate: string): boolean {
    return this.state.owned.has(relicId) && !this.state.observationRecords.some((record) => record.date === utcDate);
  }

  /** 같은 스토리 재완료는 성공으로 허용하되 기록과 유대 EXP를 다시 만들지 않는다. */
  complete(relicId: string, utcDate: string, choiceId: string): Promise<{ record: ObservationRecord; bondXpEarned: number; firstCompletion: boolean }> {
    return this.api.completeObservation({ relicId, utcDate, choiceId });
  }
}

export const observations = new ObservationManager();
