import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";

/** 행 전체를 88px 터치 영역으로 쓰는 설정 스위치다. 외곽선 없이 크기와 강조색만 바뀐다. */
export class SettingsToggle extends Phaser.GameObjects.Container {
  private value: boolean;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly stateText: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: boolean, onChange: (value: boolean) => void) {
    super(scene, x, y); this.value = value;
    this.add(scene.add.text(0, 0, label, textStyle({ role: "body", size: 28 })).setOrigin(0, 0.5));
    this.stateText = scene.add.text(820, 0, "", textStyle({ role: "emphasis", size: 25 })).setOrigin(1, 0.5);
    this.knob = scene.add.circle(858, 0, 15, COLOR.accent); this.add([this.stateText, this.knob]);
    const hit = scene.add.rectangle(450, 0, 900, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.setScale(1.03)); hit.on("pointerup", () => { this.setScale(1); this.value = !this.value; this.paint(); onChange(this.value); });
    this.add(hit); this.paint(); scene.add.existing(this);
  }
  /** 활성 상태를 테두리 대신 금색·확대로 구분한다. */
  private paint(): void { this.stateText.setText(this.value ? "ON" : "OFF").setColor(this.value ? COLOR.accentText : COLOR.inkDim); this.knob.setFillStyle(this.value ? COLOR.accent : COLOR.panelEdge).setScale(this.value ? 1.18 : 1); }
}
