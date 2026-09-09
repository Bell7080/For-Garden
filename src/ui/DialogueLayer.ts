import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import type { DialogueChoice, DialogueNode, DialogueStandingAsset } from "../core/dialogue";
import { DialoguePlaybackClock } from "../core/dialoguePlayback";
import { settingsManager } from "../managers/SettingsManager";
import { LEXIA_ASSET, playMotion, SEIRA_ASSET, spawnPuppet, TORIKA_ASSET, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
import { drawGlassFade, drawHairline } from "./holo";
import { COLOR, textStyle } from "./theme";

const ASSETS: Record<DialogueStandingAsset, PuppetAsset> = { torika: TORIKA_ASSET, lexia: LEXIA_ASSET, seira: SEIRA_ASSET };
const PANEL_TOP = 1270;

/** 1080×1920 안전 영역 안에서 모든 스토리가 공유하는 대사/선택/스탠딩 표시다. */
export class DialogueLayer extends Phaser.GameObjects.Container {
  private readonly speaker: Phaser.GameObjects.Text;
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
    this.speaker = scene.add.text(92, PANEL_TOP + 52, "", textStyle({ role: "display", size: 34, color: COLOR.accentText }));
    this.bodyText = scene.add.text(92, PANEL_TOP + 126, "", textStyle({ role: "body", size: 36, wrap: BASE_WIDTH - 184, lineSpacing: 14 }));
    this.nextMark = scene.add.text(BASE_WIDTH - 100, PANEL_TOP + 464, "▼", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);
    this.add([glass, topLine, blocker, this.speaker, this.bodyText, this.nextMark]);
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
    if (!this.isRenderOwnerActive()) return;
    const generation = ++this.renderGeneration;
    this.cancelTyping();
    this.clearChoices();
    this.speaker.setText(node.expression ? `${node.speaker}  ·  ${node.expression}` : node.speaker);
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
