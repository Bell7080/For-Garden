import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";

/** 허용 선택지를 순환하며 행 전체를 최소 터치 영역으로 제공하는 선택 행이다. */
export class SettingsSelectRow<T extends string | number> extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: T, choices: readonly T[], onChange: (value: T) => void) {
    super(scene, x, y); this.add(scene.add.text(0, 0, label, textStyle({ role: "body", size: 28 })).setOrigin(0, 0.5));
    const shown = scene.add.text(900, 0, String(value), textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(1, 0.5); this.add(shown);
    const hit = scene.add.rectangle(450, 0, 900, 88, 0xffffff, 0).setInteractive({ useHandCursor: true }); hit.on("pointerdown", () => this.setScale(1.03)); hit.on("pointerup", () => { this.setScale(1); value = choices[(choices.indexOf(value) + 1) % choices.length]; shown.setText(String(value)); onChange(value); }); this.add(hit); scene.add.existing(this);
  }
}
