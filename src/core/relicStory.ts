import type { DialogueStory } from "./dialogue";

/**
 * **개체 하나의 이야기 묶음이다.** 관찰 일지의 글·관찰 질문·애착 스토리·유대 대사가 모두 한 파일에
 * 모여 있어야 "이 아이가 어떤 아이인가"를 한 번에 읽으며 고칠 수 있다. 문장은 데이터가 갖고, 이 타입은
 * 모양만 정한다 — 화면은 이 묶음을 읽을 뿐 문장을 따로 적지 않는다.
 */

/** 애착 스토리가 열리는 유대 레벨. 상한(10)이 마지막 장이다. */
export const BOND_STORY_LEVELS = [4, 6, 8, 10] as const;
export type BondStoryLevel = (typeof BOND_STORY_LEVELS)[number];

/** 질문 하나를 답하면 받는 젬. 질문마다 한 번이다. */
export const DIARY_QUESTION_GEM_REWARD = 50;
/** 관찰 질문은 개체마다 정확히 셋이다. */
export const DIARY_QUESTION_COUNT = 3;

export interface RelicDiaryChoice {
  id: string;
  /** 선택지에 적히는 연구원의 관찰 한 줄(예: 「눈을 반짝이며 좋아하는 잎 이름을 줄줄 읊는다」). */
  label: string;
  /** 고른 직후 그 개체가 하는 말. */
  reply: string;
  /** 일지에 남는 기록 문장 — 일기처럼 읽히는 한두 줄. */
  note: string;
}

export interface RelicDiaryQuestion {
  id: string;
  prompt: string;
  choices: readonly RelicDiaryChoice[];
}

export interface RelicStoryProfile {
  relicId: string;
  /**
   * 발굴 기록의 첫머리 — 어떤 화석을 복원한 개체인가. 사실만 짧게 적고 성격은 아래 일기가 맡는다.
   */
  fossilRecord: string;
  /**
   * 복원 후 관찰 기록. **일지를 쓰는 연구원의 문체**로, 그 개체의 매력과 성격 위주로 적는다 — 보고서처럼
   * 쓰지 않고 읽으며 웃게 되는 일기처럼.
   */
  diary: string;
  /**
   * 일기가 끝난 뒤 회색으로 서는, 그 개체가 연구원에게 건네는 한마디. 뽑기 대사와 달리 일상에서 툭 던지는
   * 말이라 그 개체의 성격이 한 줄에 드러나야 한다.
   */
  closingLine: string;
  /** 일지 하단에서 < > 로 넘기는 관찰 질문 셋. */
  questions: readonly [RelicDiaryQuestion, RelicDiaryQuestion, RelicDiaryQuestion];
  /** 유대 4·6·8·10에서 하나씩 열리는 애착 스토리. */
  bondStories: Readonly<Record<BondStoryLevel, DialogueStory>>;
  /**
   * 로비에서 누를 때 하는 말. 인덱스가 유대 레벨(0~10)이고 레벨마다 여러 줄을 두어 같은 레벨에서도
   * 매번 같은 말만 하지 않게 한다.
   */
  bondLines: readonly (readonly string[])[];
}

/**
 * 애착 스토리 한 장을 처음 읽을 때 받는 젬. 네 장 모두 같은 값이다.
 * 질문(50)보다 크게 두어 유대를 올릴 이유를 보상으로도 말한다.
 */
export const BOND_STORY_GEM_REWARD: Readonly<Record<BondStoryLevel, number>> = { 4: 100, 6: 100, 8: 100, 10: 100 };

/** 애착 스토리 장의 저장 ID. 개체와 유대 레벨이 곧 키다. */
export function bondChapterId(relicId: string, level: BondStoryLevel): string {
  return `${relicId}:${level}`;
}

/**
 * 관찰 질문이 열리는 시각(UTC 자정 기준 epoch ms).
 *
 * 처음 만난 날에 첫 질문이 열리고 하루에 하나씩 열린다 — 처음 얻은 개체는 사흘에 걸쳐 젬이 들어온다.
 * 처음 만난 날이 기록되지 않은 개체(기록 도입 전에 얻은 개체)는 모두 열려 있다.
 */
export function diaryQuestionUnlockAt(metAt: string | undefined, index: number): number {
  if (!metAt) return 0;
  const met = new Date(metAt);
  return Date.UTC(met.getUTCFullYear(), met.getUTCMonth(), met.getUTCDate() + index);
}
