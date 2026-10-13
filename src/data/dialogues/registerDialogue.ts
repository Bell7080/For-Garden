/**
 * 대사 원문을 언어별로 덮어쓸 수 있게 등록한다.
 *
 * 대사는 이야기 ID와 노드 ID가 이미 안정적인 키라, 그 둘을 그대로 쓴다. 노드 ID는 저장과
 * 분기 참조에 쓰이므로 번역하지 않는다 — 옮기는 것은 화자 이름과 본문, 선택지 문구, 그리고
 * 이야기를 여는 제목과 부제뿐이다.
 */
import type { DialogueStory } from "../../core/dialogue";
import { registerDataText } from "../../i18n";
import { speakerStanding } from "./speakerStanding";

export function registerDialogueTexts(story: DialogueStory): void {
  if (story.titleCard) {
    registerDataText(story.titleCard, "title", `dialogue.${story.id}.title`);
    registerDataText(story.titleCard, "subtitle", `dialogue.${story.id}.subtitle`);
  }
  for (const node of story.nodes) {
    // 화자가 전신 원화를 가진 사람이면 따로 적지 않아도 말하는 순간 그 얼굴이 선다. 이름은 번역 등록
    // 전(한국어 원문)에 읽어야 한다 — 등록하면 화자 이름이 언어를 따라 바뀐다.
    if (!node.standing && node.speaker) node.standing = speakerStanding(node.speaker);
    const key = `dialogue.${story.id}.${node.id}`;
    // 화자가 빈 노드는 지문이다. 옮길 이름이 없으므로 등록하지 않는다 — 등록하면 번역 표가
    // 빈 값을 채워야 하는데 표는 빈 값을 받지 않는다.
    if (node.speaker) registerDataText(node, "speaker", `${key}.speaker`);
    registerDataText(node, "body", `${key}.body`);
    node.choices?.forEach((choice, index) => registerDataText(choice, "label", `${key}.choice.${index}`));
  }
}
