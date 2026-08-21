import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
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

/** 둥근 모서리 정사각형. 한 변 대비 이 비율만큼 깎는다. */
const CORNER = 0.3;

/**
 * 아이콘 하나만 얹은 둥근 정사각형 버튼.
 *
 * 테두리를 두르지 않고 그림자와 명도 차이로만 떠 보이게 한다. 게임 안의 모든 뒤로가기가
 * 같은 모양·같은 자리를 쓰도록 생김새는 이 프리팹에서만 정한다.
 */
export class IconButton extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, options: IconButtonOptions) {
    super(scene, x, y);
    const size = options.size ?? 108;
    const radius = size * CORNER;
    const half = size / 2;

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.42).fillRoundedRect(-half + 3, -half + 9, size, size, radius);
    this.add(this.shadow);

    const face = scene.add.graphics();
    face.fillStyle(COLOR.panel, 0.96).fillRoundedRect(-half, -half, size, size, radius);
    // 위쪽만 아주 옅게 밝혀 평평한 사각형이 아니라 눌리는 판처럼 보이게 한다.
    face.fillStyle(0xffffff, 0.05).fillRoundedRect(-half, -half, size, size * 0.45, radius);
    this.add(face);

    this.add(scene.add.image(0, 0, options.icon).setDisplaySize(size * 0.52, size * 0.52).setTint(0xf2f0ec));

    if (options.label) {
      this.add(
        scene.add.text(half + 18, 0, options.label, textStyle({ role: "body", size: Math.round(size * 0.26), color: COLOR.inkDim })).setOrigin(0, 0.5),
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

  /** 누르는 동안 살짝 작아지고 그림자가 붙는다. */
  private press(down: boolean): void {
    this.setScale(down ? 0.94 : 1);
    this.shadow.setAlpha(down ? 0.5 : 1);
  }
}

/** 뒤로가기의 고정 자리. 엄지가 닿는 오른쪽 아래 구석이다. */
export const BACK_SLOT = { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120 } as const;

/** 화면을 벗어나는 유일한 버튼. 자리와 생김새를 씬마다 다시 정하지 않는다. */
export function addBackButton(scene: Phaser.Scene, onClick: () => void): IconButton {
  return new IconButton(scene, BACK_SLOT.x, BACK_SLOT.y, { icon: UI_ICON.back, onClick });
}
