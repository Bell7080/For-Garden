import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

export interface ControlChipOptions {
  /** 조작 의미를 나타내는 공용 선 아이콘이다. */
  icon: GlyphName;
  label: string;
  width?: number;
  height?: number;
  onClick: () => void;
}

/** 전투의 배속·자동 궁극기처럼 상태가 바뀌는 작은 홀로그램 칩이다. */
export class ControlChip extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private activeState = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ControlChipOptions) {
    super(scene, x, y);
    const width = options.width ?? 150;
    const height = options.height ?? 76;
    // 기존 카드처럼 서로 다른 모서리를 깎고 사방 테두리 대신 윗변 강조선만 사용한다.
    const shape = chipPoints(width, height, {
      bevel: { topLeft: 8, topRight: 22, bottomRight: 8, bottomLeft: 18 },
    });
    this.face = drawLayer(scene, 0, 0, shape, { fill: 0x1f2632, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.4 });
    this.label = scene.add.text(22, 0, options.label, textStyle({ role: "emphasis", size: 22, color: COLOR.ink })).setOrigin(0.5);
    this.add([this.face, drawGlyph(scene, options.icon, -width / 2 + 32, 0, 34, COLOR.inkDimHex), this.label]);

    // 투명 입력면은 터치에서 깎인 모서리를 빗나가도 안정적으로 눌리게 한다.
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.setScale(1.08));
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => { this.setScale(1); options.onClick(); });
    this.add(hit);
    scene.add.existing(this);
  }

  /** 배속 순환처럼 같은 칩의 현재 값을 교체한다. */
  setLabel(label: string): this {
    this.label.setText(label);
    return this;
  }

  /** 켜진 자동 기능은 색과 약간의 확대를 함께 써서 꺼진 상태와 구분한다. */
  setActive(active: boolean): this {
    this.activeState = active;
    this.face.setAlpha(active ? 1 : HOLO.glass);
    this.label.setColor(active ? COLOR.accentText : COLOR.ink);
    return this;
  }

  /** 테스트와 씬 갱신에서 현재 토글 상태를 읽는 공개 계약이다. */
  isActive(): boolean {
    return this.activeState;
  }
}
