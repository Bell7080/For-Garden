import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DialogueFlow, dialogueStandingOrder, type DialogueChoice, type DialogueStory } from "../core/dialogue";
import { getRecollectionStory } from "../data/dialogues/recollections";
import { bindDebugReadyLifecycle, setDebugReady, setDebugScene } from "../debug";
import { storyManager } from "../managers/StoryManager";
import { DialogueLayer } from "../ui/DialogueLayer";
import { drawLayer, slantedRect } from "../ui/holo";
import { COLOR } from "../ui/theme";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { playStoryTitleCard } from "../ui/StoryTitleCard";

/** 지도 서브 노드의 정적 대사를 재생하고 완료 저장 뒤 지도를 새로 만드는 전용 씬이다. */
export class StageStoryScene extends Phaser.Scene {
  private story!: DialogueStory;
  private flow!: DialogueFlow;
  private layer?: DialogueLayer;

  constructor() { super("stageStory"); }

  create(data: { storyId: string }): void {
    // 대사 씬도 다른 ready 소유 씬과 같은 시작/종료 초기화 규칙을 사용한다.
    bindDebugReadyLifecycle(this.events);
    this.story = getRecollectionStory(data.storyId);
    this.flow = new DialogueFlow(this.story);
    setDebugScene("stageStory");
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-40);
    this.layer = new DialogueLayer(this, (choice) => this.advance(choice), { backdrop: this.story.backdrop });
    // 배경 원화가 없는 이야기만 기존 홀로그램 면을 깐다. 원화가 있으면 그 판이 원화를 가린다.
    if (!this.layer.stage.hasBackdrop) {
      drawLayer(this, BASE_WIDTH / 2, 560, slantedRect(880, 720), { fill: 0x141920, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.25 }).setDepth(-20);
    }
    this.layer.prefetch(dialogueStandingOrder(this.story));
    void this.openStory();
    setDebugReady(true);
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /** 제목표가 있는 이야기는 그것이 걷힌 뒤에 첫 대사를 연다. */
  private async openStory(): Promise<void> {
    if (this.story.titleCard) {
      await playStoryTitleCard(this, this.story.titleCard);
      // 제목표가 도는 사이 씬이 닫혔으면 첫 대사를 열지 않는다.
      if (!this.scene.isActive()) return;
    }
    // DialogueFlow는 최초 표시 잠금으로 시작하므로 Puppet 비동기 준비가 끝난 뒤에만 커서를 연다.
    await this.layer?.show(this.flow.current).finally(() => this.flow.markCurrentNodeReady());
  }

  private advance(choice?: DialogueChoice): void {
    const result = this.flow.advance(choice?.id);
    if (result.effect) storyManager.applyEffect(this.story.id, result.effect);
    if (result.completed) {
      // StoryManager만 completedStoryIds를 변경하며 새 지도 씬이 해금/완료 표시를 다시 계산한다.
      storyManager.complete(this.story.id);
      startScene(this, "stageMap");
      return;
    }
    // 후속 노드도 같은 흐름 잠금을 사용해 Puppet 교체와 연속 입력이 경쟁하지 않게 한다.
    void this.layer?.show(result.node!).finally(() => this.flow.markCurrentNodeReady());
  }
}
