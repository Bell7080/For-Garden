import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DialogueFlow, type DialogueChoice, type DialogueStory } from "../core/dialogue";
import { getRecollectionStory } from "../data/dialogues/recollections";
import { setDebugReady, setDebugScene } from "../debug";
import { storyManager } from "../managers/StoryManager";
import { DialogueLayer } from "../ui/DialogueLayer";
import { drawLayer, slantedRect } from "../ui/holo";
import { COLOR } from "../ui/theme";

/** 지도 서브 노드의 정적 대사를 재생하고 완료 저장 뒤 지도를 새로 만드는 전용 씬이다. */
export class StageStoryScene extends Phaser.Scene {
  private story!: DialogueStory;
  private flow!: DialogueFlow;
  private layer?: DialogueLayer;

  constructor() { super("stageStory"); }

  create(data: { storyId: string }): void {
    this.story = getRecollectionStory(data.storyId);
    this.flow = new DialogueFlow(this.story);
    setDebugScene("stageStory");
    // 기존 홀로그램 면과 색만 사용해 별도 스토리 테마를 만들지 않는다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);
    drawLayer(this, BASE_WIDTH / 2, 560, slantedRect(880, 720), { fill: 0x141920, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.25 });
    this.layer = new DialogueLayer(this, (choice) => this.advance(choice));
    void this.layer.show(this.flow.current).finally(() => this.flow.unlockInput());
    setDebugReady(true);
  }

  private advance(choice?: DialogueChoice): void {
    const result = this.flow.advance(choice?.id);
    if (result.effect) storyManager.applyEffect(this.story.id, result.effect);
    if (result.completed) {
      // StoryManager만 completedStoryIds를 변경하며 새 지도 씬이 해금/완료 표시를 다시 계산한다.
      storyManager.complete(this.story.id);
      this.scene.start("stageMap");
      return;
    }
    void this.layer?.show(result.node!).finally(() => this.flow.unlockInput());
  }
}
