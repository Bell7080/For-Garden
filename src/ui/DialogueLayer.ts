import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import type { DialogueChoice, DialogueNode, DialogueStandingAsset } from "../core/dialogue";
import { LEXIA_ASSET, playMotion, SEIRA_ASSET, spawnPuppet, TORIKA_ASSET, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
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

  constructor(scene: Phaser.Scene, private readonly onAdvance: (choice?: DialogueChoice) => void) {
    super(scene, 0, 0);
    const blocker = scene.add.rectangle(BASE_WIDTH / 2, PANEL_TOP + 290, BASE_WIDTH - 64, 540, COLOR.panel, 0.92).setStrokeStyle(3, COLOR.panelEdge);
    blocker.setInteractive({ useHandCursor: true }).on("pointerup", () => {
      // 선택지가 떠 있을 때 패널 탭으로 분기를 건너뛰지 않는다.
      if (this.choiceObjects.length === 0) this.onAdvance();
    });
    this.speaker = scene.add.text(92, PANEL_TOP + 52, "", textStyle({ role: "display", size: 34, color: COLOR.accentText }));
    this.bodyText = scene.add.text(92, PANEL_TOP + 126, "", textStyle({ role: "body", size: 36, wrap: BASE_WIDTH - 184, lineSpacing: 14 }));
    this.nextMark = scene.add.text(BASE_WIDTH - 100, PANEL_TOP + 464, "▼", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);
    this.add([blocker, this.speaker, this.bodyText, this.nextMark]);
    this.setDepth(600);
    scene.add.existing(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyStanding());
  }

  /** 노드가 바뀔 때 이전 선택 UI를 폐기하고 Puppet 캐시에서 필요한 스탠딩만 교체한다. */
  async show(node: DialogueNode): Promise<void> {
    const generation = ++this.renderGeneration;
    this.clearChoices();
    this.speaker.setText(node.expression ? `${node.speaker}  ·  ${node.expression}` : node.speaker);
    this.bodyText.setText(node.body);
    this.nextMark.setVisible(!node.choices?.length);
    if (!node.standing) this.destroyStanding();
    else if (node.standing !== this.standingKey) {
      this.destroyStanding();
      const creature = await spawnPuppet(this.scene, ASSETS[node.standing], { focus: { anchor: "core", x: BASE_WIDTH / 2, y: 735 }, height: 1120, depth: 100 });
      // 빠르게 다음 노드로 이동한 동안 끝난 비동기 로드가 옛 스탠딩을 되살리지 않게 한다.
      if (generation !== this.renderGeneration || !this.active) { creature.destroy(); return; }
      this.standing = creature;
      this.standingKey = node.standing;
      creature.setAlpha(0);
      this.scene.tweens.add({ targets: creature, alpha: 1, x: creature.x, duration: 220 });
    }
    if (this.standing && node.motion) playMotion(this.scene, this.standing, node.motion);
    this.buildChoices(node.choices ?? []);
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

  private destroyStanding(): void {
    if (this.standing) {
      // 퇴장은 즉시 참조를 끊어 다음 비동기 등장과 입력 상태가 섞이지 않게 한다.
      const exiting = this.standing;
      this.scene.tweens.add({ targets: exiting, alpha: 0, duration: 140, onComplete: () => exiting.destroy() });
    }
    this.standing = undefined;
    this.standingKey = undefined;
  }
}
