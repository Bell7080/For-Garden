import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { CONTROL_CHIP_ACTIVE, perimeterPoint, type ControlChipTierLevel } from "./controlChipStyle";
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

/**
 * 전투의 배속·자동 궁극기처럼 상태가 바뀌는 작은 홀로그램 칩이다.
 *
 * **켜지면 판이 노랗게 물들고 테두리를 빛이 돈다**(`controlChipStyle.ts`). 단계가 있는 칩(배속)은
 * 단계마다 빛이 빨라지고 줄기가 는다. 움직임 줄이기가 켜져 있으면 빛은 돌지 않고 둘레만 밝게 선다.
 */
export class ControlChip extends Phaser.GameObjects.Container {
  private readonly shape: number[];
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly tint: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly iconIdle: Phaser.GameObjects.Graphics;
  private readonly iconActive: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private spin?: Phaser.Tweens.Tween;
  private activeState = false;
  private tier: ControlChipTierLevel = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ControlChipOptions) {
    super(scene, x, y);
    const width = options.width ?? 150;
    const height = options.height ?? 76;
    // 기존 카드처럼 서로 다른 모서리를 깎고, 꺼진 판은 사방 테두리 대신 윗변 강조선만 쓴다.
    this.shape = chipPoints(width, height, {
      bevel: { topLeft: 8, topRight: 22, bottomRight: 8, bottomLeft: 18 },
    });
    this.face = drawLayer(scene, 0, 0, this.shape, { fill: 0x161c26, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.4 });
    this.tint = scene.add.graphics().setVisible(false);
    this.ring = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const iconX = -width / 2 + 32;
    this.iconIdle = drawGlyph(scene, options.icon, iconX, 0, 34, COLOR.inkDimHex);
    this.iconActive = drawGlyph(scene, options.icon, iconX, 0, 34, COLOR.accent).setVisible(false);
    // 아이콘과 글자 사이의 얇은 세로 구분선 — 둘이 한 덩어리로 뭉치지 않고 "무엇 · 지금 값"으로 읽힌다.
    const divider = scene.add.rectangle(iconX + 26, 0, 1.5, height * 0.46, COLOR.inkDimHex, 0.35);
    this.label = scene.add.text(22, 0, options.label, textStyle({ role: "emphasis", size: 22, color: COLOR.ink })).setOrigin(0.5);
    this.add([this.face, this.tint, this.ring, divider, this.iconIdle, this.iconActive, this.label]);

    // 투명 입력면은 터치에서 깎인 모서리를 빗나가도 안정적으로 눌리게 한다.
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.setScale(1.08));
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => { this.setScale(1); options.onClick(); });
    this.add(hit);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.stopSpin());
    scene.add.existing(this);
  }

  /** 배속 순환처럼 같은 칩의 현재 값을 교체한다. */
  setLabel(label: string): this {
    this.label.setText(label);
    return this;
  }

  /**
   * 켜짐과 그 세기. 단계가 없는 칩은 1단계로 켜진다.
   *
   * 같은 상태로 다시 불러도 도는 빛을 새로 세우지 않는다 — 매번 세우면 한 바퀴 도중에 머리가
   * 처음 자리로 튀어 돌아간다.
   */
  setActive(active: boolean, tier: number = 1): this {
    const level = Math.min(3, Math.max(1, Math.round(tier))) as ControlChipTierLevel;
    const changed = active !== this.activeState || level !== this.tier;
    this.activeState = active;
    this.tier = level;
    this.face.setAlpha(active ? 1 : HOLO.glass);
    this.label.setColor(active ? COLOR.accentText : COLOR.ink);
    this.iconIdle.setVisible(!active);
    this.iconActive.setVisible(active);
    this.tint.setVisible(active);
    this.ring.setVisible(active);
    if (!changed) return this;
    this.stopSpin();
    if (!active) return this;
    const spec = CONTROL_CHIP_ACTIVE.tiers[level];
    this.tint.clear().fillStyle(CONTROL_CHIP_ACTIVE.fill, spec.fillAlpha).fillPoints(this.toPoints(), true);
    if (motionPolicy(session.settings).nonEssentialRepeatFactor === 0) {
      // 움직임 줄이기: 빛은 돌지 않고 둘레 전체가 한 번 밝게 선다.
      this.drawRing(0, true);
      return this;
    }
    const state = { t: 0 };
    this.drawRing(0, false);
    this.spin = this.scene.tweens.add({
      targets: state, t: 1, duration: spec.spinMs, repeat: -1,
      onUpdate: () => this.drawRing(state.t, false),
    });
    return this;
  }

  /** 테스트와 씬 갱신에서 현재 토글 상태를 읽는 공개 계약이다. */
  isActive(): boolean {
    return this.activeState;
  }

  /** 지금 켜짐의 세기. 꺼져 있으면 0이다. */
  activeTier(): number {
    return this.activeState ? this.tier : 0;
  }

  private stopSpin(): void {
    this.spin?.remove();
    this.spin = undefined;
  }

  private toPoints(): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < this.shape.length; index += 2) points.push(new Phaser.Math.Vector2(this.shape[index], this.shape[index + 1]));
    return points;
  }

  /**
   * 둘레를 도는 빛. 옅은 둘레 한 줄 위에 줄기마다 머리에서 꼬리로 옅어지는 토막을 잇는다.
   * 번짐 한 겹을 먼저 굵게 깔고 그 위에 가는 선을 그어, 선이 스스로 빛나는 것처럼 보인다.
   */
  private drawRing(phase: number, steady: boolean): void {
    const spec = CONTROL_CHIP_ACTIVE.tiers[this.tier];
    const ring = this.ring.clear();
    ring.lineStyle(1.5, COLOR.accent, steady ? 0.95 : CONTROL_CHIP_ACTIVE.outlineAlpha).strokePoints(this.toPoints(), true, true);
    if (steady) {
      ring.lineStyle(spec.glowWidth * 0.6, COLOR.accent, spec.glowAlpha * 0.6).strokePoints(this.toPoints(), true, true);
      return;
    }
    const segments = CONTROL_CHIP_ACTIVE.segments;
    for (let comet = 0; comet < spec.comets; comet += 1) {
      const head = phase + comet / spec.comets;
      for (let index = 0; index < segments; index += 1) {
        const from = perimeterPoint(this.shape, head - (spec.tail * (index + 1)) / segments);
        const to = perimeterPoint(this.shape, head - (spec.tail * index) / segments);
        const fade = 1 - index / segments;
        const color = index < 2 ? CONTROL_CHIP_ACTIVE.headColor : COLOR.accent;
        ring.lineStyle(spec.glowWidth * fade, COLOR.accent, spec.glowAlpha * fade).lineBetween(from.x, from.y, to.x, to.y);
        ring.lineStyle(spec.lineWidth, color, fade).lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }
}
