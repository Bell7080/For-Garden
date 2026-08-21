import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";
import { UI_ICON } from "./icons";

export interface IconButtonOptions {
  /** 텍스처 키. `UI_ICON`의 값을 쓴다. */
  icon: string;
  /** 정사각형 한 변(px). */
  size?: number;
  /** 아이콘 오른쪽에 붙는 짧은 설명. 없으면 아이콘만 있는 정사각형이다. */
  label?: string;
  onClick: () => void;
}

/**
 * 아이콘 하나만 얹은 칩 버튼.
 *
 * 카드와 같은 언어로 모서리를 어긋나게 깎는다. 되돌아가는 방향인 왼쪽 아래를 크게 깎아
 * 버튼 자체가 뒤를 가리키게 두고, 테두리 대신 그림자와 윗변 한 줄로만 떠 보이게 한다.
 * 게임 안의 모든 뒤로가기가 같은 모양·같은 자리를 쓰도록 생김새는 이 프리팹에서만 정한다.
 */
export class IconButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, options: IconButtonOptions) {
    super(scene, x, y);
    const size = options.size ?? 108;

    // 되돌아가는 방향인 왼쪽 아래를 크게 깎고 마주 보는 오른쪽 위를 조금 깎는다.
    // 네 모서리를 고르게 깎으면 반듯한 팔각형이 되어 방향이 사라진다.
    const shape = chipPoints(size, size, {
      bevel: { topLeft: size * 0.06, topRight: size * 0.38, bottomRight: size * 0.06, bottomLeft: size * 0.42 },
    });
    this.face = drawLayer(scene, 0, 0, shape, { fill: 0x1f2632, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 });
    // 크게 깎인 모서리에만 강조선을 한 줄 더 그어 잘린 면이 빛을 받는 것처럼 보이게 한다.
    const cut = scene.add.graphics();
    cut.lineStyle(HOLO.lineWidth, COLOR.accent, 0.5);
    cut.lineBetween(-size / 2, size / 2 - size * 0.42, -size / 2 + size * 0.42, size / 2);
    this.add([this.face, cut]);

    this.add(scene.add.image(0, 0, options.icon).setDisplaySize(size * 0.5, size * 0.5).setTint(0xf2f0ec));

    if (options.label) {
      this.add(
        scene.add.text(size / 2 + 18, 0, options.label, textStyle({ role: "body", size: Math.round(size * 0.26), color: COLOR.inkDim })).setOrigin(0, 0.5),
      );
    }

    const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.press(true));
    hit.on("pointerout", () => this.press(false));
    hit.on("pointerup", () => {
      this.press(false);
      options.onClick();
    });
    this.add(hit);

    this.setSize(size, size);
    scene.add.existing(this);
  }

  /** 누르는 동안 커진다. 화면의 다른 누름과 같은 신호를 쓴다. */
  private press(down: boolean): void {
    this.setScale(down ? 1.08 : 1);
  }
}

/** 뒤로가기의 고정 자리. 엄지가 닿는 오른쪽 아래 구석이다. */
export const BACK_SLOT = { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120 } as const;

/** 화면을 벗어나는 유일한 버튼. 자리와 생김새를 씬마다 다시 정하지 않는다. */
export function addBackButton(scene: Phaser.Scene, onClick: () => void): IconButton {
  return new IconButton(scene, BACK_SLOT.x, BACK_SLOT.y, { icon: UI_ICON.back, onClick });
}
