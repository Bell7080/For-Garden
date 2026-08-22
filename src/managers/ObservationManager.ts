import { BOND_XP_REWARD, grantBondXp } from "../core/bond";
import type { DialogueStory } from "../core/dialogue";
import { createObservationStory, observationDiscovery } from "../data/observations";
import { PLAYABLE_RELICS } from "../data/relics";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type ObservationRecord, type Session } from "../state/session";

/** 일일 한도, 최초 보상, 관찰 기록 저장을 한 트랜잭션처럼 확정하는 유일한 경계다. */
export class ObservationManager {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}

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

  /** 같은 스토리 재완료는 성공적으로 허용하되 기록과 유대 EXP를 다시 만들지 않는다. */
  complete(relicId: string, utcDate: string, choiceId: string): { record: ObservationRecord; bondXpEarned: number; firstCompletion: boolean } {
    const story = this.storyFor(relicId, utcDate);
    const previous = this.state.observationRecords.find((record) => record.storyId === story.id);
    if (previous) return { record: previous, bondXpEarned: 0, firstCompletion: false };
    if (!this.canStart(relicId, utcDate)) throw new RangeError("오늘의 관찰 인터뷰는 이미 완료했습니다.");
    const discovery = observationDiscovery(relicId, utcDate, choiceId);
    const record: ObservationRecord = { date: utcDate, relicId, storyId: story.id, questionId: discovery.question.id, question: discovery.question.prompt, choiceId: discovery.choice.id, answer: discovery.choice.label, personalityTag: discovery.choice.personalityTag, discoveredHabit: discovery.habit };
    const progress = this.state.relicProgress[relicId];
    if (!progress) throw new RangeError("관찰 대상의 유대 정보가 없습니다.");
    const reward = grantBondXp(progress, BOND_XP_REWARD.firstObservationInterview);
    const next = { ...this.state, completedStoryIds: new Set(this.state.completedStoryIds).add(story.id), observationRecords: [...this.state.observationRecords, record], relicProgress: { ...this.state.relicProgress, [relicId]: reward.progress } };
    this.saves.save(next);
    // 공유 Session 참조를 유지하면서 저장 검증이 끝난 필드만 교체한다.
    this.state.completedStoryIds = next.completedStoryIds;
    this.state.observationRecords = next.observationRecords;
    this.state.relicProgress = next.relicProgress;
    return { record, bondXpEarned: reward.xpGained, firstCompletion: true };
  }
}

export const observations = new ObservationManager();
