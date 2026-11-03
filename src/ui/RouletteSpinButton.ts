import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { drawSparkle, ROULETTE_TONE } from "./rouletteWheel";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";

export interface RouletteSpinButtonOptions {
  width: number;
  height: number;
  label: string;
  /** 테와 눌린 두께의 색. 무료는 민트, 광고는 분홍처럼 무엇으로 돌리는지가 색으로 먼저 읽힌다. */
  tone: number;
  /** 글 왼쪽에 서는 그림(광고 아이콘). */
  iconKey?: string;
  onClick: () => void;
}

/**
 * 돌림판의 돌리기 버튼 — 바퀴와 같은 장난감 결의 **말랑한 알약**이다(연구소 `ResearchPullButton`과 같은 문법).
 *
 * 크림 면 + 제 색의 두꺼운 테 + 아래로 떨어지는 두께, 짙은 자두빛 외곽선. 누를 수 있는 동안은 천천히 숨 쉬고,
 * 누르면 두께만큼 내려앉는다. 오른쪽 끝에는 남은 수를 말하는 작은 배지(`2/3`)가 붙을 수 있다.
 */
export class RouletteSpinButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Container;
  private readonly badgeText: Phaser.GameObjects.Text;
  private readonly icon?: Phaser.GameObjects.Image;
  private breathe?: Phaser.Tweens.Tween;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: RouletteSpinButtonOptions) {
    super(scene, x, y);
    const { width, height, tone } = options;
    const radius = height / 2;
    const depth = 14;
    const outline = 5;
    const base = scene.add.graphics();
    base.fillStyle(0x000000, 0.3).fillRoundedRect(-width / 2 + 6, -height / 2 + depth + 10, width, height, radius);
    base.fillStyle(ROULETTE_TONE.ink, 1).fillRoundedRect(-width / 2 - outline, -height / 2 - outline, width + outline * 2, height + depth + outline * 2, radius + outline);
    base.fillStyle(Phaser.Display.Color.ValueToColor(tone).darken(26).color, 1).fillRoundedRect(-width / 2, -height / 2 + depth, width, height, radius);
    this.add(base);

    this.face = scene.add.container(0, 0);
    const plate = scene.add.graphics();
    plate.fillStyle(tone, 1).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    plate.fillStyle(ROULETTE_TONE.cream, 1).fillRoundedRect(-width / 2 + 9, -height / 2 + 9, width - 18, height - 18, radius - 9);
    plate.fillStyle(0xffffff, 0.8).fillRoundedRect(-width / 2 + radius * 0.8, -height / 2 + 16, width - radius * 1.6, 9, 4);
    // 크림 면에 흩어진 작은 물방울 무늬 — 사탕 포장지처럼 귀엽게, 글보다 먼저 읽히지 않게 옅게.
    plate.fillStyle(tone, 0.22);
    for (let index = 0; index < 9; index += 1) {
      const px = -width / 2 + radius + ((index * 0.618) % 1) * (width - radius * 2);
      const py = -height * 0.18 + ((index * 0.37) % 1) * height * 0.42;
      plate.fillCircle(px, py, 5 + (index % 3) * 2);
    }
    this.face.add(plate);
    const sparkle = scene.add.graphics();
    drawSparkle(sparkle, -width / 2 + radius * 0.62, -height * 0.12, height * 0.13, tone);
    drawSparkle(sparkle, width / 2 - radius * 0.62, height * 0.1, height * 0.1, tone);
    this.face.add(sparkle);

    if (options.iconKey) {
      this.icon = scene.add.image(0, 0, options.iconKey).setDisplaySize(height * 0.48, height * 0.48);
      this.face.add(this.icon);
    }
    this.label = scene.add.text(0, 0, options.label, textStyle({ role: "display", size: Math.round(height * 0.3), color: ROULETTE_TONE.inkText })).setOrigin(0.5);
    this.face.add(this.label);

    this.badge = scene.add.container(width / 2 - radius * 0.25, -height / 2 + 6);
    const badgePlate = scene.add.graphics();
    badgePlate.fillStyle(ROULETTE_TONE.ink, 1).fillRoundedRect(-52, -24, 104, 48, 24);
    badgePlate.fillStyle(ROULETTE_TONE.pointer, 1).fillRoundedRect(-48, -20, 96, 40, 20);
    this.badgeText = scene.add.text(0, 0, "", textStyle({ role: "display", size: 26, color: "#ffffff" })).setOrigin(0.5).setStroke(ROULETTE_TONE.inkText, 5);
    this.badge.add([badgePlate, this.badgeText]).setVisible(false);
    this.face.add(this.badge);
    this.add(this.face);
    this.layoutLabel();

    const hit = scene.add.rectangle(0, depth / 2, width, height + depth, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => { if (this.enabled) this.face.setY(depth * 0.7); });
    hit.on("pointerout", () => this.face.setY(0));
    hit.on("pointerup", () => {
      this.face.setY(0);
      if (this.enabled) options.onClick();
    });
    this.add(hit);
    this.setSize(width, height + depth);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.breathe?.remove());
    this.syncBreath();
  }

  setLabel(label: string): this {
    this.label.setText(label);
    this.layoutLabel();
    return this;
  }

  /** 오른쪽 위 배지 — 비우면 감춘다. */
  setBadge(text: string | undefined): this {
    this.badge.setVisible(Boolean(text));
    this.badgeText.setText(text ?? "");
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.62);
    this.syncBreath();
    return this;
  }

  override setVisible(value: boolean): this {
    super.setVisible(value);
    if (this.face) this.syncBreath();
    return this;
  }

  /** 그림과 글을 한 덩어리로 가운데에 놓고, 넘치면 글만 가로로 누른다. */
  private layoutLabel(): void {
    const { width, height } = this.options;
    const iconWidth = this.icon ? height * 0.48 + 14 : 0;
    this.label.setScale(1);
    shrinkTextToWidth(this.label, width - height * 1.3 - iconWidth);
    const total = iconWidth + this.label.displayWidth;
    if (this.icon) this.icon.setX(-total / 2 + height * 0.24);
    this.label.setX(-total / 2 + iconWidth + this.label.displayWidth / 2);
  }

  private syncBreath(): void {
    const alive = this.enabled && this.visible && motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
    if (alive && !this.breathe) {
      this.breathe = this.scene.tweens.add({ targets: this.face, scaleX: 1.035, scaleY: 0.97, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    } else if (!alive && this.breathe) {
      this.breathe.remove();
      this.breathe = undefined;
      this.face.setScale(1);
    }
  }
}
