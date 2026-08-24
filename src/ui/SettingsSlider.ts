import Phaser from "phaser";
import { HoloBar } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 게이지가 놓이는 자리(행 왼쪽 기준). 홈·채움·손잡이가 모두 이 한 값을 따른다. */
const BAR = { x: 560, width: 380, height: 18 } as const;

/**
 * 소리 크기 같은 0~1 값을 행 전체 드래그로 정하는 줄.
 *
 * 게이지는 `HoloBar`의 옅은 홈과 기울어진 채움을 그대로 쓴다. **게이지 두 겹은 반드시 이
 * 컨테이너 안에 담는다** — 씬에 따로 세우면 목록이 스크롤될 때 글자만 움직이고 막대는
 * 제자리에 남아 다른 줄 위에 겹쳐 그려진다.
 */
export class SettingsSlider extends Phaser.GameObjects.Container {
  private readonly bar: HoloBar;
  private readonly amount: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, value: number, onChange: (value: number) => void) {
    super(scene, x, y);
    this.add(scene.add.text(0, 0, label, textStyle({ role: "body", size: 28 })).setOrigin(0, 0.5));
    // 좌표는 전부 줄 안쪽 기준이다. 바깥 좌표를 섞으면 스크롤·확대에서 어긋난다.
    this.bar = new HoloBar(scene, BAR.x, 0, BAR.width, BAR.height, { color: COLOR.accent });
    this.amount = scene.add.text(900, 0, "", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(1, 0.5);
    this.add([...this.bar.objects, this.amount]);

    const paint = (next: number): void => {
      value = Phaser.Math.Clamp(next, 0, 1);
      this.bar.setValue(value);
      this.amount.setText(`${Math.round(value * 100)}%`);
    };
    // 손가락 위치는 화면 좌표로 오고 게이지는 스크롤되는 목록 안에 있다. 줄의 현재 월드
    // 좌표에서 다시 재야 스크롤한 뒤에도 누른 자리와 값이 맞는다.
    const set = (pointer: Phaser.Input.Pointer): void => {
      const matrix = this.getWorldTransformMatrix();
      const left = matrix.tx + (BAR.x - BAR.width / 2) * matrix.scaleX;
      paint((pointer.worldX - left) / (BAR.width * matrix.scaleX));
      onChange(value);
    };
    const hit = scene.add.rectangle(450, 0, 900, 88, 0xffffff, 0).setInteractive({ useHandCursor: true, draggable: true });
    hit.on("pointerdown", set);
    hit.on("drag", set);
    this.add(hit);
    paint(value);
    scene.add.existing(this);
  }
}
