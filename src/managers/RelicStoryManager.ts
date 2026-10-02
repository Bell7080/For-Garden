import { gameApi } from "../api/FakeServer";
import type { GameApi } from "../api/contracts";
import { BOND_STORY_LEVELS, bondChapterId, diaryQuestionUnlockAt, type BondStoryLevel } from "../core/relicStory";
import { relicStoryFor } from "../data/relicStories";
import { session, type Session } from "../state/session";

export type DiaryQuestionStatus = "locked" | "open" | "answered";

export interface DiaryQuestionView {
  index: number;
  questionId: string;
  status: DiaryQuestionStatus;
  /** 열리는 시각(epoch ms). 이미 열렸으면 지금보다 이전이다. */
  unlocksAt: number;
  /** 답한 선택지. 답하지 않았으면 없다. */
  answeredChoiceId?: string;
}

export interface BondChapterView {
  level: BondStoryLevel;
  storyId: string;
  /** 유대 레벨이 닿아 읽을 수 있는가. */
  unlocked: boolean;
  /** 해금 젬을 이미 받았는가. */
  claimed: boolean;
}

const DAY_MS = 86_400_000;

/**
 * 렐릭 이야기(관찰 질문·애착 스토리)의 **읽기 전용 조회와 서버 호출 연결**이다.
 *
 * 젬을 주고 답변·수령을 확정하는 일은 전부 `GameApi`가 하고(저장 포함), 이 매니저는 화면이 쓸 상태를
 * 만들어 줄 뿐 세션을 직접 바꾸지 않는다. 같은 세션을 서버 역할이 이미 갱신하므로 호출 뒤에는 다시 읽기만 하면 된다.
 */
export class RelicStoryManager {
  constructor(private readonly state: Session = session, private readonly api: GameApi = gameApi) {}

  hasStory(relicId: string): boolean {
    return relicStoryFor(relicId) !== undefined && this.state.owned.has(relicId);
  }

  questionViews(relicId: string, now: number = Date.now()): readonly DiaryQuestionView[] {
    const story = relicStoryFor(relicId);
    if (!story) return [];
    const metAt = this.state.relicStory.metAt[relicId];
    return story.questions.map((question, index) => {
      const answer = this.state.relicStory.answers.find(({ questionId }) => questionId === question.id);
      const unlocksAt = diaryQuestionUnlockAt(metAt, index);
      const status: DiaryQuestionStatus = answer ? "answered" : now >= unlocksAt ? "open" : "locked";
      return { index, questionId: question.id, status, unlocksAt, answeredChoiceId: answer?.choiceId };
    });
  }

  /** 아직 열리지 않은 질문이 열리기까지 남은 날 수(올림). */
  daysUntil(unlocksAt: number, now: number = Date.now()): number {
    return Math.max(1, Math.ceil((unlocksAt - now) / DAY_MS));
  }

  async answer(relicId: string, questionId: string, choiceId: string): Promise<number> {
    const response = await this.api.answerRelicQuestion({ relicId, questionId, choiceId });
    return response.gemsGranted;
  }

  chapterViews(relicId: string): readonly BondChapterView[] {
    const story = relicStoryFor(relicId);
    if (!story) return [];
    const bondLevel = this.state.relicProgress[relicId]?.bondLevel ?? 0;
    return BOND_STORY_LEVELS.map((level) => ({
      level,
      storyId: story.bondStories[level].id,
      unlocked: this.state.owned.has(relicId) && bondLevel >= level,
      claimed: this.state.relicStory.claimedChapterIds.includes(bondChapterId(relicId, level)),
    }));
  }

  /** 이야기 ID가 어느 개체의 애착 스토리 몇 장인지. 아니면 없다. */
  chapterForStoryId(storyId: string): { relicId: string; level: BondStoryLevel } | undefined {
    const match = /^bond\.([^.]+)\.(\d+)$/.exec(storyId);
    const level = match ? Number(match[2]) : 0;
    const known = (BOND_STORY_LEVELS as readonly number[]).includes(level);
    return match && known && relicStoryFor(match[1]) ? { relicId: match[1], level: level as BondStoryLevel } : undefined;
  }

  async claimChapter(relicId: string, level: BondStoryLevel): Promise<number> {
    const response = await this.api.claimRelicChapter({ relicId, level });
    return response.gemsGranted;
  }
}

export const relicStories = new RelicStoryManager();
