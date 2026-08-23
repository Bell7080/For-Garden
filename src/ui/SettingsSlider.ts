import Phaser from "phaser";
import { HoloBar } from "./holo";
import { COLOR, textStyle } from "./theme";

/** HoloBar의 옅은 홈·기울어진 채움을 그대로 사용하고 행 전체 드래그를 값 입력으로 바꾼다. */
export class SettingsSlider extends Phaser.GameObjects.Container {
  private readonly bar: HoloBar; private readonly amount: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: number, onChange: (value: number) => void) {
    super(scene, x, y); this.add(scene.add.text(0, 0, label, textStyle({ role: "body", size: 28 })).setOrigin(0, 0.5));
    this.bar = new HoloBar(scene, x + 560, y, 380, 18, { color: COLOR.accent }); this.amount = scene.add.text(900, 0, "", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(1, 0.5); this.add(this.amount);
    const set = (pointer: Phaser.Input.Pointer) => { value = Math.max(0, Math.min(1, (pointer.worldX - (x + 370)) / 380)); this.bar.setValue(value); this.amount.setText(`${Math.round(value * 100)}%`); onChange(value); };
    const hit = scene.add.rectangle(450, 0, 900, 88, 0xffffff, 0).setInteractive({ useHandCursor: true, draggable: true }); hit.on("pointerdown", set); hit.on("drag", set); this.add(hit); this.bar.setValue(value); this.amount.setText(`${Math.round(value * 100)}%`); scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.bar.destroy());
  }
}
