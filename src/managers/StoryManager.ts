import { grantBondXp } from "../core/bond";
import type { DialogueEffect } from "../core/dialogue";
import { PLAYABLE_RELICS } from "../data/relics";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type Session } from "../state/session";

/** 대사 선택 명령의 검증·저장과 최초 완료 판정을 독점하는 경계다. */
export class StoryManager {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}

  isCompleted(storyId: string): boolean { return this.state.completedStoryIds.has(storyId); }

  /** 회상에서는 선택 결과를 보여 주되 보상을 다시 지급하지 않는다. */
  applyEffect(storyId: string, effect: DialogueEffect): number {
    if (this.isCompleted(storyId)) return 0;
    if (effect.type !== "bondXp") throw new RangeError("허용되지 않은 대사 효과입니다.");
    const relicExists = PLAYABLE_RELICS.some(({ id }) => id === effect.relicId);
    const progress = this.state.relicProgress[effect.relicId];
    if (!relicExists || !this.state.owned.has(effect.relicId) || !progress) throw new RangeError("대사 효과 대상 렐릭이 올바르지 않습니다.");
    // 콘텐츠 오타가 대량 보상으로 이어지지 않도록 한 선택의 유대 보상을 작은 정수로 제한한다.
    if (!Number.isInteger(effect.amount) || effect.amount < 0 || effect.amount > 20) throw new RangeError("대사 유대 보상은 0~20 정수여야 합니다.");
    const result = grantBondXp(progress, effect.amount);
    const next = { ...this.state, relicProgress: { ...this.state.relicProgress, [effect.relicId]: result.progress } };
    this.saves.save(next);
    this.state.relicProgress = next.relicProgress;
    return result.xpGained;
  }

  complete(storyId: string): boolean {
    if (!storyId || this.isCompleted(storyId)) return false;
    const completedStoryIds = new Set(this.state.completedStoryIds).add(storyId);
    this.saves.save({ ...this.state, completedStoryIds });
    this.state.completedStoryIds = completedStoryIds;
    return true;
  }
}

export const storyManager = new StoryManager();
