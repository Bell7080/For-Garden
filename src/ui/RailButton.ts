import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

export interface RailButtonOptions {
  icon: GlyphName;
  label: string;
  size?: number;
  /** 강조 버튼은 강조색 면과 밝은 선을 쓴다. 교류처럼 새 화면으로 나가는 입구에 쓴다. */
  accent?: boolean;
  onClick: () => void;
}

/**
 * 화면 옆줄에 세로로 쌓는 작은 아이콘 버튼.
 *
 * 상점·우편·친구처럼 로비에 늘 떠 있어야 하지만 주인공(캐릭터)을 가리면 안 되는 것들을 위한
 * 자리다. 글자는 아이콘 아래 한 줄만 두고, 칩은 왼쪽 위·오른쪽 아래를 깎아 방향을 준다.
 */
export class RailButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: RailButtonOptions) {
    super(scene, x, y);
    const size = options.size ?? 96;
    const color = options.accent ? COLOR.accent : 0xd2d6dc;

    this.add(drawLayer(scene, 0, 0, chipPoints(size, size, {
      bevel: { topLeft: size * 0.32, topRight: 0, bottomRight: size * 0.32, bottomLeft: 0 },
    }), {
      fill: options.accent ? 0x2a2418 : 0x1a1f27,
      alpha: HOLO.glass,
      edge: COLOR.accent,
      edgeAlpha: options.accent ? 0.85 : 0.35,
    }));
    // 글자는 칩 안 아래쪽에 둔다. 칩 밖으로 내리면 배경 원화 위에 놓여 읽히지 않는다.
    this.add(drawGlyph(scene, options.icon, 0, -size * 0.12, size * 0.42, color));
    this.add(
      scene.add
        .text(0, size * 0.2, options.label, textStyle({ role: "emphasis", size: 19, color: options.accent ? COLOR.accentText : COLOR.ink }))
        .setOrigin(0.5, 0),
    );

    const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.setScale(1.1));
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => {
      this.setScale(1);
      options.onClick();
    });
    this.add(hit);

    this.setSize(size, size);
    scene.add.existing(this);
  }
}
