import Phaser from "phaser";
import type { BattleUnit } from "../core/battle";
import { ULTIMATE_MAX } from "../core/battle";
import { addHelpBadge } from "./info";
import { COLOR, textStyle } from "./theme";

/**
 * 전장에 선 렐릭 한 명. 진형 자리에 고정되어 있고, 스왑이 일어나면
 * 그 자리에 선 유닛만 바뀐다. 위쪽에 `?`를 달아 정보창을 열 수 있다.
 */
export class UnitPanel extends Phaser.GameObjects.Container {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly slotText: Phaser.GameObjects.Text;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly energyBar: Phaser.GameObjects.Rectangle;
  private readonly barWidth: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    private readonly enemy: boolean,
    onInfo: () => void,
  ) {
    super(scene, x, y);
    this.barWidth = w - 32;

    this.box = scene.add
      .rectangle(0, 0, w, h, COLOR.panel)
      .setStrokeStyle(3, enemy ? COLOR.danger : COLOR.ally);
    this.add(this.box);

    this.nameText = scene.add
      .text(-w / 2 + 16, -h / 2 + 12, "", textStyle({ size: 32 }))
      .setOrigin(0, 0);
    this.add(this.nameText);

    this.slotText = scene.add
      .text(w / 2 - 16, -h / 2 + 20, "", textStyle({ size: 22, color: COLOR.inkDim }))
      .setOrigin(1, 0);
    this.add(this.slotText);

    // 아래에서 위로 궁극기 게이지 · HP 바 · 수치 순서로 쌓아 서로 겹치지 않게 한다.
    this.hpText = scene.add
      .text(-w / 2 + 16, h / 2 - 66, "", textStyle({ size: 24, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);
    this.add(this.hpText);

    const barY = h / 2 - 42;
    this.add(
      scene.add.rectangle(-this.barWidth / 2, barY, this.barWidth, 14, COLOR.panelEdge).setOrigin(0, 0.5),
    );
    this.hpBar = scene.add
      .rectangle(-this.barWidth / 2, barY, this.barWidth, 14, enemy ? COLOR.hpEnemy : COLOR.hpFill)
      .setOrigin(0, 0.5);
    this.add(this.hpBar);

    const energyY = h / 2 - 20;
    this.add(
      scene.add.rectangle(-this.barWidth / 2, energyY, this.barWidth, 8, COLOR.panelEdge).setOrigin(0, 0.5),
    );
    this.energyBar = scene.add
      .rectangle(-this.barWidth / 2, energyY, 0, 8, COLOR.energy)
      .setOrigin(0, 0.5);
    this.add(this.energyBar);

    // `?`는 패널 위쪽 모서리에 걸쳐 둔다.
    this.add(addHelpBadge(scene, w / 2 - 12, -h / 2 - 12, onInfo, 24));

    scene.add.existing(this);
  }

  update(unit: BattleUnit, isFront: boolean): void {
    const dead = unit.hp <= 0;
    this.nameText.setText(unit.def.name);
    this.slotText.setText(dead ? "전투 불능" : isFront ? "전방" : "후방");
    this.hpText.setText(`${unit.hp} / ${unit.maxHp}`);

    this.hpBar.width = this.barWidth * Math.max(0, unit.hp / unit.maxHp);
    this.energyBar.width = this.barWidth * (unit.energy / ULTIMATE_MAX);

    // 전방에 선 쪽을 굵은 테두리로 눈에 띄게 한다.
    this.box.setStrokeStyle(isFront ? 6 : 3, this.enemy ? COLOR.danger : COLOR.ally);
    this.setAlpha(dead ? 0.3 : 1);
  }
}
