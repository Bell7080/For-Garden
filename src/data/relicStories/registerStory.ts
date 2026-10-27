import type { RelicStoryProfile } from "../../core/relicStory";
import { registerDataText } from "../../i18n";
import { registerDialogueTexts } from "../dialogues/registerDialogue";

/**
 * 이야기 묶음의 화면 문구를 언어별로 덮어쓸 수 있게 등록한다.
 *
 * 발굴 기록·일기 글은 도감 정의(`relics.ts`)가 이미 같은 문장을 `unlockRecord`·`fossilRecord`로
 * 들고 등록하므로 여기서 한 번 더 등록하지 않는다. 여기서 맡는 것은 그 밖의 말 — 일지 맨 끝 한마디,
 * 관찰 질문(질문·선택지·답·일기 기록), 유대 대사, 애착 스토리(대사 등록기를 그대로 지난다).
 *
 * 키는 개체 ID와 질문·선택지 ID가 이미 안정적이라 그대로 쓴다. 유대 대사는 레벨과 순번이 곧 키다.
 */
export function registerRelicStoryTexts(story: RelicStoryProfile): void {
  const id = story.relicId;
  registerDataText(story, "closingLine", `story.${id}.closingLine`);
  for (const question of story.questions) {
    const base = `story.${id}.q.${question.id}`;
    registerDataText(question, "prompt", `${base}.prompt`);
    for (const choice of question.choices) {
      registerDataText(choice, "label", `${base}.${choice.id}.label`);
      registerDataText(choice, "reply", `${base}.${choice.id}.reply`);
      registerDataText(choice, "note", `${base}.${choice.id}.note`);
    }
  }
  story.bondLines.forEach((lines, level) => {
    lines.forEach((_, index) => registerDataText(lines, String(index), `story.${id}.line.${level}.${index}`));
  });
  for (const chapter of Object.values(story.bondStories)) registerDialogueTexts(chapter);
}
