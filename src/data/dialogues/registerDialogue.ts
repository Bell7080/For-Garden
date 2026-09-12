/**
 * 대사 원문을 언어별로 덮어쓸 수 있게 등록한다.
 *
 * 대사는 이야기 ID와 노드 ID가 이미 안정적인 키라, 그 둘을 그대로 쓴다. 노드 ID는 저장과
 * 분기 참조에 쓰이므로 번역하지 않는다 — 옮기는 것은 화자 이름과 본문, 선택지 문구뿐이다.
 */
import type { DialogueStory } from "../../core/dialogue";
import { registerDataText } from "../../i18n";

export function registerDialogueTexts(story: DialogueStory): void {
  for (const node of story.nodes) {
    const key = `dialogue.${story.id}.${node.id}`;
    registerDataText(node, "speaker", `${key}.speaker`);
    registerDataText(node, "body", `${key}.body`);
    node.choices?.forEach((choice, index) => registerDataText(choice, "label", `${key}.choice.${index}`));
  }
}
