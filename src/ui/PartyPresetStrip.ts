import Phaser from "phaser";
import { t } from "../i18n";
import { PARTY_PRESET_COUNT } from "../core/partyPresets";
import { drawGlyph } from "./glyphs";
import { drawLayer, slantedRect } from "./holo";
import { addBannerArrow } from "./LabBannerTitle";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 프리셋 줄의 생김새. 자동 배치 줄 왼쪽 빈자리에 같은 높이로 선다. */
export const PRESET_STRIP = {
  height: 56,
  arrow: { width: 52, height: 52, stroke: 5 },
  nameSize: 28,
  dot: { size: 9, gap: 16, rise: 19 },
} as const;

export interface PartyPresetStripOptions {
  /** 줄 왼쪽 끝과 오른쪽 끝(화면 좌표). */
  left: number;
  right: number;
  y: number;
  depth?: number;
  onStep: (direction: -1 | 1) => void;
  onRename: () => void;
}

/**
 * 편성 프리셋 줄 — `‹ 이름 ✎ ›`과 그 아래 다섯 점.
 *
 * 넘기는 손은 셋이다: 양 끝 꺾쇠, 이 줄을 옆으로 미는 손, 위의 SD를 옆으로 미는 손(씬이 건다).
 * 이름을 누르면 고치는 창이 열린다 — 고칠 수 있는 글자 옆에는 연필 하나만 서고 "편집"이라 적지 않는다.
 */
export class PartyPresetStrip extends Phaser.GameObjects.Container {
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly pencil: Phaser.GameObjects.Graphics;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly nameWidth: number;
  private enabled = true;

  constructor(scene: Phaser.Scene, private readonly options: PartyPresetStripOptions) {
    const width = options.right - options.left;
    super(scene, options.left + width / 2, options.y);
    const { height, arrow } = PRESET_STRIP;
    this.add(drawLayer(scene, 0, 0, slantedRect(width, height, 10), { fill: 0x0a0d12, alpha: 0.46, shadow: false }));
    const arrowX = width / 2 - arrow.width / 2 - 4;
    this.add(addBannerArrow(scene, -arrowX, 0, -1, () => this.enabled && options.onStep(-1), arrow));
    this.add(addBannerArrow(scene, arrowX, 0, 1, () => this.enabled && options.onStep(1), arrow));
    this.nameWidth = width - (arrow.width + 16) * 2 - 40;

    const label = scene.add.container(0, 0);
    this.nameText = scene.add.text(0, -6, "", textStyle({ role: "emphasis", size: PRESET_STRIP.nameSize, color: COLOR.ink })).setOrigin(0.5);
    this.pencil = drawGlyph(scene, "edit", 0, -6, 22, COLOR.inkDimHex, 0.9, 3);
    this.dots = scene.add.graphics();
    label.add([this.nameText, this.pencil, this.dots]);
    this.add(label);
    const hit = scene.add.rectangle(0, 0, this.nameWidth + 30, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(label));
    hit.on("pointerout", () => pressOut(label, "normal", { pop: false }));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pressOut(label);
      // 옆으로 민 손은 넘기기다(씬의 손짓 판정이 받는다). 제자리에서 뗀 손만 이름을 고친다.
      if (this.enabled && Math.abs(pointer.upX - pointer.downX) < 24) options.onRename();
    });
    this.add(hit);
    this.setDepth(options.depth ?? 4);
    scene.add.existing(this);
  }

  /** 화면 좌표의 이 줄 상자 — 씬이 그 안에서 시작한 손짓을 넘기기로 읽는다. */
  bounds(): Phaser.Geom.Rectangle {
    const width = this.options.right - this.options.left;
    return new Phaser.Geom.Rectangle(this.options.left, this.options.y - PRESET_STRIP.height / 2, width, PRESET_STRIP.height);
  }

  setPreset(index: number, name: string): this {
    this.nameText.setText(name || t("party.preset.default", { index: index + 1 }));
    this.nameText.setScale(1);
    squeezeTextToWidth(this.nameText, this.nameWidth - 34);
    const half = this.nameText.displayWidth / 2;
    this.nameText.setX(-17);
    this.pencil.setX(half - 17 + 20);
    const { size, gap, rise } = PRESET_STRIP.dot;
    const start = -((PARTY_PRESET_COUNT - 1) * gap) / 2;
    this.dots.clear();
    for (let i = 0; i < PARTY_PRESET_COUNT; i += 1) {
      const x = start + i * gap;
      const s = i === index ? size : size * 0.7;
      this.dots.fillStyle(i === index ? COLOR.accent : COLOR.inkDimHex, i === index ? 1 : 0.5);
      this.dots.fillPoints([new Phaser.Math.Vector2(x, rise - s / 2), new Phaser.Math.Vector2(x + s / 2, rise), new Phaser.Math.Vector2(x, rise + s / 2), new Phaser.Math.Vector2(x - s / 2, rise)], true);
    }
    return this;
  }

  /** 첫 편성 안내 중에는 넘기지 않는다 — 안내가 짚는 칸이 바뀐다. */
  setInteractiveEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.5);
    return this;
  }
}
