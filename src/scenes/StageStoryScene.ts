import { speakerStanding } from "../data/dialogues/speakerStanding";
import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DialogueFlow, dialogueStandingOrder, type DialogueChoice, type DialogueStory } from "../core/dialogue";
import { getRecollectionStory } from "../data/dialogues/recollections";
import { bindDebugReadyLifecycle, setDebugReady, setDebugScene } from "../debug";
import { relicStories } from "../managers/RelicStoryManager";
import { storyManager } from "../managers/StoryManager";
import { DialogueLayer } from "../ui/DialogueLayer";
import { COLOR } from "../ui/theme";
import { addSkipButton } from "../ui/IconButton";
import { PopupLayer } from "../ui/PopupLayer";
import { t } from "../i18n";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { playStoryTitleCard } from "../ui/StoryTitleCard";
import type { SceneRoute } from "./stageStoryRoute";

/** 지도 서브 노드의 정적 대사를 재생하고 완료 저장 뒤 지도를 새로 만드는 전용 씬이다. */
export class StageStoryScene extends Phaser.Scene {
  private story!: DialogueStory;
  private flow!: DialogueFlow;
  private layer?: DialogueLayer;
  /** 이야기가 끝나면 갈 곳. 지도에서 연 곁 이야기는 지도로, 전투 뒤에 이어진 막은 넘겨준 곳으로 간다. */
  private exitTo = "stageMap";
  /** 있으면 `exitTo` 대신 이 길로 이어 간다 — 전 대사 뒤 편성, 후 대사 뒤 결과판의 다음 길. */
  private then?: SceneRoute;
  private popups!: PopupLayer;
  /** 마지막 입력과 스킵이 겹쳐도 완료 저장과 다음 화면 전환은 한 번만 수행한다. */
  private leaving = false;

  constructor() { super("stageStory"); }

  create(data: { storyId: string; exitTo?: "lobby" | "stageMap"; then?: SceneRoute }): void {
    this.exitTo = data.exitTo ?? "stageMap";
    this.then = data.then;
    this.leaving = false;
    // 대사 씬도 다른 ready 소유 씬과 같은 시작/종료 초기화 규칙을 사용한다.
    bindDebugReadyLifecycle(this.events);
    this.story = getRecollectionStory(data.storyId);
    this.flow = new DialogueFlow(this.story);
    setDebugScene("stageStory");
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-40);
    this.layer = new DialogueLayer(this, (choice) => this.advance(choice), { backdrop: this.story.backdrop ?? "relics" });
    this.layer.prefetch(dialogueStandingOrder(this.story, speakerStanding));
    void this.openStory();
    this.popups = new PopupLayer(this, 2500);
    this.addStorySkip();
    setDebugReady(true);
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /** 모든 스토리 장면의 스킵. 묻고 나서 정상 완료와 같은 길로 간다(중간 선택지의 효과는 받지 않는다). */
  private addStorySkip(): void {
    // 대사 화면(깊이 600)과 섬광(650) 위에 서야 한다 — 뒤로가기 깊이(50)로 두면 가려진다.
    addSkipButton(this, t("opening.skip"), () => {
      if (this.leaving) return;
      this.popups.confirm({ title: t("opening.skip.title"), message: t("opening.skip.message"), confirmLabel: t("opening.skip") }, () => this.finish());
    }).setDepth(700);
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

  /** 애착 스토리 장이면 처음 읽은 해금 젬을 서버에서 받는다. 이미 받았거나 실패해도 이야기는 그대로 끝난다. */
  private async claimChapterGems(): Promise<void> {
    const chapter = relicStories.chapterForStoryId(this.story.id);
    if (!chapter) return;
    await relicStories.claimChapter(chapter.relicId, chapter.level).catch(() => undefined);
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    // StoryManager만 completedStoryIds를 변경하며 새 지도 씬이 해금/완료 표시를 다시 계산한다.
    // 완료가 서버에 닿은 뒤에 장 보상을 받고 넘어간다 — 실패해도 장면은 끊지 않는다.
    void storyManager.complete(this.story.id).catch((error) => console.error("이야기 완료 저장 실패", error)).then(() => this.claimChapterGems()).finally(() => {
      if (this.then) startScene(this, this.then.scene, this.then.data);
      else startScene(this, this.exitTo);
    });
  }

  private advance(choice?: DialogueChoice): void {
    if (this.leaving) return;
    const result = this.flow.advance(choice?.id);
    if (result.effect) void storyManager.applyEffect(this.story.id, result.effect).catch((error) => console.error("선택 효과 저장 실패", error));
    if (result.completed) {
      this.finish();
      return;
    }
    // 후속 노드도 같은 흐름 잠금을 사용해 Puppet 교체와 연속 입력이 경쟁하지 않게 한다.
    void this.layer?.show(result.node!).finally(() => this.flow.markCurrentNodeReady());
  }
}
