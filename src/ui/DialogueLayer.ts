import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import type { DialogueChoice, DialogueNode, DialogueStandingAsset } from "../core/dialogue";
import { DialoguePlaybackClock } from "../core/dialoguePlayback";
import { settingsManager } from "../managers/SettingsManager";
import { LEXIA_ASSET, playMotion, SEIRA_ASSET, spawnPuppet, TORIKA_ASSET, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
import { DIALOGUE_BUBBLE } from "./dialogueBubbleLayout";
import { drawGlassFade, drawHairline } from "./holo";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";

const ASSETS: Record<DialogueStandingAsset, PuppetAsset> = { torika: TORIKA_ASSET, lexia: LEXIA_ASSET, seira: SEIRA_ASSET };
const PANEL_TOP = 1270;

/**
 * 이야기 대사판도 **공용 대사창과 같은 문법**을 쓴다.
 *
 * 판 자체는 화면 밑동을 통째로 덮는 유리면이라 띠 한 장으로 줄일 수 없지만, 화자 이름은 판
 * 안이 아니라 **윗선에 걸터앉는 제목표**가 맡는다 — 로비·상점·정보창의 대사창과 같은 자리에
 * 같은 빗금으로 서므로, 짧은 한마디든 긴 이야기든 "누가 말하는가"가 한 양식으로 읽힌다.
 * 이름과 본문을 가르던 자리도 그 선 하나가 대신해 본문이 한 줄만큼 위로 올라온다.
 */
const PANEL_TEXT = { nameX: 82, bodyX: 92, bodyY: PANEL_TOP + 74, nameSize: 34 } as const;

/** 1080×1920 안전 영역 안에서 모든 스토리가 공유하는 대사/선택/스탠딩 표시다. */
export class DialogueLayer extends Phaser.GameObjects.Container {
  /** 화자 이름표. 노드마다 글자 폭이 달라지므로 판 한 장을 다시 만든다. */
  private speakerPlate?: Phaser.GameObjects.Container;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly nextMark: Phaser.GameObjects.Text;
  private readonly choiceObjects: Phaser.GameObjects.GameObject[] = [];
  private standing?: PuppetCreature;
  private standingKey?: DialogueStandingAsset;
  private renderGeneration = 0;
  /** 현재 노드의 타이핑을 소유해 노드 교체와 빠른 입력이 이전 콜백을 남기지 않게 한다. */
  private typingEvent?: Phaser.Time.TimerEvent;
  private pendingChoices: readonly DialogueChoice[] = [];
  private isTyping = false;
  private fullBody = "";
  /** 설정을 노드마다 다시 읽는 실행 경계라 화면을 재생성하지 않아도 다음 대사에 새 배속이 적용된다. */
  private readonly playbackClock = new DialoguePlaybackClock(() => settingsManager.get().game.textSpeed);
  /** 종료가 시작된 컨테이너에는 늦게 도착한 비동기 Puppet 결과를 다시 붙이지 않는다. */
  private terminated = false;
  /** Phaser가 Container의 scene 참조를 정리해도 생성 당시 씬의 실행 상태를 판정하는 기준이다. */
  private readonly ownerScene: Phaser.Scene;

  constructor(scene: Phaser.Scene, private readonly onAdvance: (choice?: DialogueChoice) => void) {
    super(scene, 0, 0);
    this.ownerScene = scene;
    // 대사판도 테두리를 두르지 않는다. 아래로 짙어지는 유리면과 윗선 한 줄로만 자리를 잡는다.
    const glass = drawGlassFade(scene, BASE_WIDTH / 2, PANEL_TOP + 300, BASE_WIDTH, 620, { topAlpha: 0.2, bottomAlpha: 0.95 });
    const topLine = drawHairline(scene, BASE_WIDTH / 2, PANEL_TOP - 10, BASE_WIDTH, { color: COLOR.accent, alpha: 0.3 });
    const blocker = scene.add.rectangle(BASE_WIDTH / 2, PANEL_TOP + 290, BASE_WIDTH, 620, 0xffffff, 0);
    blocker.setInteractive({ useHandCursor: true }).on("pointerup", () => {
      // 선택지가 떠 있을 때 패널 탭으로 분기를 건너뛰지 않는다.
      if (this.choiceObjects.length > 0) return;
      // 타이핑 중 첫 입력은 본문만 완성하고, 완성된 뒤의 별도 입력만 다음 노드로 진행한다.
      if (this.isTyping) { this.finishTyping(); return; }
      this.onAdvance();
    });
    this.bodyText = scene.add.text(PANEL_TEXT.bodyX, PANEL_TEXT.bodyY, "", textStyle({ role: "body", size: 36, wrap: BASE_WIDTH - 184, lineSpacing: DIALOGUE_BUBBLE.lineSpacing + 6 }));
    this.nextMark = scene.add.text(BASE_WIDTH - 100, PANEL_TOP + 464, "▼", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);
    this.add([glass, topLine, blocker, this.bodyText, this.nextMark]);
    this.setDepth(600);
    scene.add.existing(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // 종료 세대는 진행 중인 show를 모두 무효화해 종료된 씬에서 비동기 Puppet 결과가 되살아나는 것을 막는다.
      this.terminated = true;
      this.renderGeneration += 1;
      this.cancelTyping();
      this.destroyStanding(false);
    });
  }

  /** 노드가 바뀔 때 이전 선택 UI를 폐기하고 Puppet 캐시에서 필요한 스탠딩만 교체한다. */
  async show(node: DialogueNode): Promise<void> {
    // Phaser의 create() 안에서는 scene.isActive()가 아직 false일 수 있어도 첫 화자·본문 UI는 그려야 한다.
    if (this.terminated) return;
    const generation = ++this.renderGeneration;
    this.cancelTyping();
    this.clearChoices();
    this.setSpeaker(node.expression ? `${node.speaker}  ·  ${node.expression}` : node.speaker);
    this.pendingChoices = node.choices ?? [];
    this.startTyping(node.body);
    if (!node.standing) this.destroyStanding();
    else if (node.standing !== this.standingKey) {
      this.destroyStanding();
      const creature = await spawnPuppet(this.scene, ASSETS[node.standing], { focus: { anchor: "core", x: BASE_WIDTH / 2, y: 735 }, height: 1120, depth: 100 });
      // 요청 교체와 씬 종료를 함께 확인해 종료된 씬에서 비동기 Puppet 결과가 되살아나는 것을 막는다.
      if (generation !== this.renderGeneration || !this.isRenderOwnerActive()) { creature.destroy(); return; }
      this.standing = creature;
      this.standingKey = node.standing;
      creature.setAlpha(0);
      this.scene.tweens.add({ targets: creature, alpha: 1, x: creature.x, duration: 220 });
    }
    if (this.standing && node.motion) playMotion(this.scene, this.standing, node.motion);
  }

  /** 화자 이름표를 판 윗선에 다시 세운다. 이름 길이가 노드마다 달라 판째로 갈아 끼운다. */
  private setSpeaker(label: string): void {
    this.speakerPlate?.destroy();
    this.speakerPlate = addSectionTitle(this.scene, PANEL_TEXT.nameX, PANEL_TOP - 10, label, { size: PANEL_TEXT.nameSize, parent: this });
  }

  /** 현재 설정으로 글자 간격을 계산하고 본문 완성 전에는 진행 표식과 선택지를 감춘다. */
  private startTyping(body: string): void {
    const characters = Array.from(body);
    const timing = this.playbackClock.timingFor(body);
    this.fullBody = body;
    this.bodyText.setText("");
    this.nextMark.setVisible(false);
    this.isTyping = characters.length > 0;
    if (!this.isTyping) { this.finishTyping(); return; }
    let visibleCount = 0;
    this.typingEvent = this.scene.time.addEvent({
      delay: timing.characterMs,
      repeat: characters.length - 1,
      callback: () => {
        // 한 타이머만 본문을 소유하며 마지막 글자에서 선택지 또는 진행 표식을 연다.
        visibleCount += 1;
        this.bodyText.setText(characters.slice(0, visibleCount).join(""));
        if (visibleCount === characters.length) this.finishTyping();
      },
    });
  }

  /** 빠른 입력과 자연 완료가 공유하는 단일 완료 경계다. */
  private finishTyping(): void {
    this.typingEvent?.remove(false);
    this.typingEvent = undefined;
    this.isTyping = false;
    // Timer 완료와 빠른 입력 모두 같은 원문으로 끝나 일부 문자열이 남는 경로를 없앤다.
    this.bodyText.setText(this.fullBody);
    this.nextMark.setVisible(this.pendingChoices.length === 0);
    this.buildChoices(this.pendingChoices);
  }

  /** 노드 교체 시 타이머와 그 타이머가 참조하던 원문을 함께 폐기한다. */
  private cancelTyping(): void {
    this.typingEvent?.remove(false);
    this.typingEvent = undefined;
    this.isTyping = false;
    this.fullBody = "";
  }

  /** 컨테이너와 그 컨테이너를 만든 원래 씬이 모두 렌더 가능한 동안에만 후속 연출을 허용한다. */
  private isRenderOwnerActive(): boolean {
    return !this.terminated && this.active && this.ownerScene.scene.isActive();
  }

  private buildChoices(choices: readonly DialogueChoice[]): void {
    choices.forEach((choice, index) => {
      const button = new Button(this.scene, BASE_WIDTH / 2, 1050 + index * 130, {
        width: BASE_WIDTH - 160, height: 104, label: choice.label, fontSize: 30,
        onClick: () => this.onAdvance(choice),
      }).setDepth(610);
      this.choiceObjects.push(button);
    });
  }

  private clearChoices(): void { this.choiceObjects.splice(0).forEach((object) => object.destroy()); }

  private destroyStanding(animated = true): void {
    // 퇴장은 즉시 참조를 끊어 다음 비동기 등장과 입력 상태가 섞이지 않게 한다.
    const exiting = this.standing;
    this.standing = undefined;
    this.standingKey = undefined;
    if (!exiting) return;
    // 씬 종료 중에는 컨테이너가 먼저 파괴돼 this.scene이 비어 있다. 그때 tween을 걸면
    // 종료가 예외로 끊겨 다음 씬(로비)이 아예 시작되지 않는다.
    if (!animated || !this.scene?.tweens) {
      exiting.destroy();
      return;
    }
    this.scene.tweens.add({ targets: exiting, alpha: 0, duration: 140, onComplete: () => exiting.destroy() });
  }
}
