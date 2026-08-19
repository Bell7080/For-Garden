import Phaser from "phaser";
import type { BattleUnit } from "../core/battle";
import { COLOR, textStyle } from "./theme";

// 이름과 HP 수치가 한 줄에 나란히 들어갈 만큼은 넓어야 한다.
const WIDTH = 250;

/**
 * 전장에 선 렐릭의 발밑에 붙는 이름표. 이름 · HP · 궁극기 게이지만 담는다.
 *
 * 캐릭터가 서 있을 자리를 그림에 내주려고 테두리 상자 없이 얇게 만들었다.
 * 자세한 정보는 머리 위 `?`로 연다.
 */
export class UnitTag extends Phaser.GameObjects.Container {
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly energyBar: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly enemy: boolean,
  ) {
    super(scene, x, y);

    this.nameText = scene.add.text(-WIDTH / 2, -26, "", textStyle({ size: 24 })).setOrigin(0, 0);
    this.add(this.nameText);

    this.hpText = scene.add
      .text(WIDTH / 2, -20, "", textStyle({ size: 18, color: COLOR.inkDim }))
      .setOrigin(1, 0);
    this.add(this.hpText);

    this.add(scene.add.rectangle(-WIDTH / 2, 10, WIDTH, 12, COLOR.panelEdge).setOrigin(0, 0.5));
    this.hpBar = scene.add
      .rectangle(-WIDTH / 2, 10, WIDTH, 12, enemy ? COLOR.hpEnemy : COLOR.hpFill)
      .setOrigin(0, 0.5);
    this.add(this.hpBar);

    this.add(scene.add.rectangle(-WIDTH / 2, 26, WIDTH, 6, COLOR.panelEdge).setOrigin(0, 0.5));
    this.energyBar = scene.add
      .rectangle(-WIDTH / 2, 26, 0, 6, COLOR.energy)
      .setOrigin(0, 0.5);
    this.add(this.energyBar);

    scene.add.existing(this);
  }

  update(unit: BattleUnit, isFront: boolean): void {
    const dead = unit.hp <= 0;
    this.nameText.setText(unit.def.name);
    // 선봉은 이름 색으로 알린다. 이름표가 얇아 따로 표시를 넣을 자리가 없다.
    this.nameText.setColor(isFront ? (this.enemy ? COLOR.dangerText : COLOR.accentText) : COLOR.ink);
    this.hpText.setText(dead ? "전투 불능" : `${unit.hp} / ${unit.maxHp}`);

    this.hpBar.width = WIDTH * Math.max(0, unit.hp / unit.maxHp);
    // 게이지 최대치는 전역 상수가 아니라 각 렐릭 궁극기의 비용이다.
    this.energyBar.width = WIDTH * (unit.energy / unit.def.ultimate.cost);
    this.setAlpha(dead ? 0.35 : 1);
  }
}
