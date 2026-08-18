import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  /** 아래에 작게 붙는 보조 문구. */
  sub?: string;
  fontSize?: number;
  fill?: number;
  onClick: () => void;
}

/** 눌리는 사각 버튼. 비활성화하면 흐려지고 입력을 받지 않는다. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly subText?: Phaser.GameObjects.Text;
  private enabledState = true;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);

    this.bg = scene.add
      .rectangle(0, 0, opts.width, opts.height, opts.fill ?? COLOR.panel)
      .setStrokeStyle(3, COLOR.accent);
    this.add(this.bg);

    // 빈 문자열로 시작해 나중에 setSub로 채우는 버튼이 있다. undefined일 때만 자리를 없앤다.
    const hasSub = opts.sub !== undefined;
    this.add(
      scene.add
        .text(0, hasSub ? -14 : 0, opts.label, textStyle({ size: opts.fontSize ?? 36 }))
        .setOrigin(0.5),
    );
    if (hasSub) {
      this.subText = scene.add
        .text(0, 26, opts.sub ?? "", textStyle({ size: 26, color: COLOR.inkDim }))
        .setOrigin(0.5);
      this.add(this.subText);
    }

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on("pointerdown", () => {
      if (this.enabledState) opts.onClick();
    });

    scene.add.existing(this);
  }

  /** 보조 문구를 갈아끼운다. 진형이 바뀌면 버튼이 가리키는 대상도 바뀐다. */
  setSub(text: string): this {
    this.subText?.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabledState = enabled;
    this.setAlpha(enabled ? 1 : 0.35);
    return this;
  }
}
