import Phaser from "phaser";
import { drawLayer, slantedRect } from "./holo";
import { SETTINGS_TOGGLE as T, settingsKnobOffsetX, settingsStateLabelOffsetX, settingsTrackCenterX } from "./settingsToggleLayout";
import { COLOR, textStyle } from "./theme";

/**
 * 설정 스위치 한 줄.
 *
 * **자리가 상태를 말한다.** 예전에는 같은 자리의 점 하나가 조금 커지고 노래질 뿐이라 그 줄만
 * 봐서는 지금 어느 쪽인지 알 수 없었다. 지금은 손잡이가 홈 안에서 미끄러지고, 손잡이가 비운
 * 쪽에 그 상태의 글자가 선다 — 꺼져 있으면 손잡이가 왼쪽에, "OFF"가 오른쪽에.
 *
 * 모양은 화면 전체와 같은 규칙이다: 동그라미가 아니라 **살짝 기운 면**이고, 사방 외곽선 없이
 * 윗변 강조선과 그림자로만 깊이를 만든다.
 */
export class SettingsToggle extends Phaser.GameObjects.Container {
  private value: boolean;
  private readonly knob: Phaser.GameObjects.Container;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly track: Phaser.GameObjects.Container;
  private slide?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: boolean, onChange: (value: boolean) => void) {
    super(scene, x, y);
    this.value = value;
    this.add(scene.add.text(0, 0, label, textStyle({ role: "body", size: 28 })).setOrigin(0, 0.5));

    // 홈과 손잡이를 한 컨테이너에 담아, 눌린 크기가 두 조각에 따로 걸리지 않게 한다.
    this.track = scene.add.container(settingsTrackCenterX(), 0);
    this.track.add(drawLayer(scene, 0, 0, slantedRect(T.trackWidth, T.trackHeight), {
      fill: 0x0b0f15, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.34,
    }));
    this.stateText = scene.add.text(settingsStateLabelOffsetX(value), 0, "", textStyle({ role: "emphasis", size: 22 })).setOrigin(0.5);
    this.track.add(this.stateText);
    this.knob = scene.add.container(settingsKnobOffsetX(value), 0);
    this.track.add(this.knob);
    this.add(this.track);

    const hit = scene.add.rectangle(450, 0, 900, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 누르면 커진다 — 눌린 상태를 색이 아니라 크기로 알리는 화면 전체의 규칙이다.
    hit.on("pointerdown", () => this.track.setScale(1.06));
    hit.on("pointerout", () => this.track.setScale(1));
    hit.on("pointerup", () => {
      this.track.setScale(1);
      this.value = !this.value;
      this.paint();
      onChange(this.value);
    });
    this.add(hit);
    this.paint(true);
    scene.add.existing(this);
  }

  /**
   * 손잡이를 지금 상태의 자리로 옮긴다.
   *
   * 처음 그릴 때만 즉시 앉히고, 이후에는 미끄러진다 — 화면을 열 때 스위치들이 한꺼번에
   * 움직이면 무엇이 바뀐 것처럼 보인다.
   */
  private paint(immediate = false): void {
    const tone = this.value ? COLOR.accent : COLOR.panelEdge;
    this.knob.removeAll(true);
    this.knob.add(drawLayer(this.scene, 0, 0, slantedRect(T.knobWidth, T.knobHeight), {
      fill: tone, alpha: this.value ? 0.94 : 0.72, edge: tone, edgeAlpha: 0.9,
    }));
    this.stateText.setText(this.value ? "ON" : "OFF").setColor(this.value ? COLOR.accentText : COLOR.inkDim);
    const knobX = settingsKnobOffsetX(this.value);
    const labelX = settingsStateLabelOffsetX(this.value);
    this.slide?.stop();
    if (immediate) {
      this.knob.setX(knobX);
      this.stateText.setX(labelX);
      return;
    }
    this.slide = this.scene.tweens.add({
      targets: [this.knob, this.stateText],
      x: (target: Phaser.GameObjects.Container) => (target === this.knob ? knobX : labelX),
      duration: T.slideMs,
      ease: "Quad.Out",
    });
  }
}
