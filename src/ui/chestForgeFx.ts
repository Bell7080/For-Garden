import Phaser from "phaser";
import { CHEST_GRADE_MAX, CHEST_GRADE_THRESHOLDS, chestGrade } from "../core/chestForge";
import { CHEST_GRADE_LOOKS } from "../core/chestRecolor";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { session } from "../state/session";
import { CHEST_ART, CHEST_ART_CONTENT, chestGlowColor, ensureChestTexture } from "./chestArt";
import { drawSparkle } from "./rouletteWheel";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";

/**
 * 보물상자의 연출 — 상자 무대(등급이 오를수록 색·크기·빛이 달라지는 상자와 게이지), 카드 한 장의 「지이잉 → 핑 → 쾅」,
 * 성공 카드가 상자로 날아 들어가는 길, 실패 카드가 깨지는 조각, 마지막 상자 열림.
 *
 * 결과는 모두 서버가 이미 정했다. 여기는 그 결과를 보여 주기만 하고 난수를 쓰지 않는다 — 조각·반짝임의 자리는 번호에서 나온다.
 */

export interface ChestFxMotion {
  /** 움직이는 거리 배율(움직임 줄이기 0.4). */
  readonly distance: number;
  /** 끝없이 도는 장식을 켤지. */
  readonly loops: boolean;
  /** 화면 흔들림 배율(끄면 0). */
  readonly shake: number;
  /** 화면을 덮는 섬광을 쓸지. */
  readonly flash: boolean;
}
export function chestFxMotion(): ChestFxMotion {
  const policy = motionPolicy(session.settings);
  return { distance: policy.nonEssentialDistanceFactor, loops: policy.nonEssentialRepeatFactor > 0, shake: policy.cameraShakeFactor, flash: !session.settings.accessibility.reduceFlashes };
}

export function waitFx(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => { scene.time.delayedCall(ms, () => resolve()); });
}
function tweenTo(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => { scene.tweens.add({ ...config, onComplete: () => resolve() }); });
}
/** 번호에서 나오는 0~1 — 같은 연출은 늘 같은 자리에 흩어진다. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 화려함(0 안전 ~ 4 대박)에 따른 반짝임 색. */
const FLAIR_COLORS: readonly (readonly number[])[] = [
  [0xffffff, 0xdff7ee],
  [0xffffff, 0xcfe6ff, 0xffe9a8],
  [0xffffff, 0xffd27a, 0xffb48a],
  [0xffffff, 0xd6c2ff, 0xffe27a, 0xa8e6ff],
  [0xffffff, 0xffe27a, 0xffb347, 0xff9ec8, 0x9fe8ff, 0xc6a8ff],
];

/** 한 점에서 반짝이 조각을 흩뿌린다. `rise`가 양수면 조금 떠오르며 흩어진다. */
export function burstSparkles(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  options: { count: number; radius: number; size: number; colors: readonly number[]; seed?: number; rise?: number; duration?: number }): void {
  const seed = options.seed ?? 1;
  for (let index = 0; index < options.count; index += 1) {
    const angle = (index / options.count) * Math.PI * 2 + hash01(seed + index) * 0.6;
    const reach = options.radius * (0.55 + hash01(seed * 3 + index) * 0.6);
    const size = options.size * (0.6 + hash01(seed * 7 + index) * 0.7);
    const sparkle = scene.add.graphics({ x, y });
    drawSparkle(sparkle, 0, 0, size, options.colors[index % options.colors.length], 1);
    parent.add(sparkle);
    scene.tweens.add({
      targets: sparkle, x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach - (options.rise ?? 0),
      angle: (hash01(seed + index * 5) - 0.5) * 180, scale: { from: 0.4, to: 1.1 }, alpha: { from: 1, to: 0 },
      duration: (options.duration ?? 520) + hash01(seed + index * 11) * 220, ease: "Cubic.Out",
      onComplete: () => sparkle.destroy(),
    });
  }
}

/**
 * 상자 무대 — 뒤의 빛무리·햇살, 상자 그림, 앞의 반짝임, 아래 게이지 한 줄.
 * 게이지는 네 칸이 문턱 넷이고, 칸마다 그 칸을 채우면 닿는 등급의 색이다.
 */
export class ChestStage {
  readonly root: Phaser.GameObjects.Container;
  private readonly aura: Phaser.GameObjects.Graphics;
  private readonly rays: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image;
  private readonly front: Phaser.GameObjects.Container;
  private readonly gauge?: Phaser.GameObjects.Graphics;
  private grade = 0;
  private shown = 0;
  private opened = false;
  private twinkles: Phaser.Tweens.Tween[] = [];
  private gaugeTween?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
    private readonly baseScale: number, private readonly options: { gaugeY?: number; gaugeWidth?: number } = {}) {
    this.root = scene.add.container(x, y);
    parent.add(this.root);
    this.aura = scene.add.graphics();
    this.rays = scene.add.graphics();
    this.image = scene.add.image(0, 0, ensureChestTexture(scene, 0, false)).setScale(baseScale);
    this.front = scene.add.container(0, 0);
    this.root.add([this.aura, this.rays, this.image, this.front]);
    if (options.gaugeY !== undefined) {
      this.gauge = scene.add.graphics();
      this.root.add(this.gauge);
    }
    if (chestFxMotion().loops) scene.tweens.add({ targets: this.rays, angle: 360, duration: 18000, repeat: -1 });
    this.paintLook(false);
    this.paintGauge(0);
  }

  get currentGrade(): number { return this.grade; }
  /** 등급에 따른 상자 크기 — 한 단계마다 6%씩 커진다. */
  private scaleFor(grade: number): number { return this.baseScale * (1 + grade * 0.06); }
  /** 카드가 들어가는 입구(부모 좌표) — 닫힌 상자의 뚜껑 이음매 언저리다. */
  mouth(): { x: number; y: number } {
    const scale = this.scaleFor(this.grade);
    const top = CHEST_ART_CONTENT.closed.top - CHEST_ART.height / 2;
    return { x: this.root.x, y: this.root.y + (top + 50) * scale };
  }

  /** 상자 등급의 결 — 빛무리 진하기, 햇살, 둘레의 반짝임. */
  private paintLook(open: boolean): void {
    const grade = this.grade;
    const glow = chestGlowColor(grade);
    const scale = this.scaleFor(grade);
    this.image.setTexture(ensureChestTexture(this.scene, grade, open || this.opened)).setScale(scale);
    this.aura.clear();
    const rings = 3 + grade;
    for (let ring = rings; ring > 0; ring -= 1) {
      this.aura.fillStyle(glow, 0.07 + grade * 0.02).fillEllipse(0, 20 * scale, (300 + ring * 70) * scale, (210 + ring * 48) * scale);
    }
    this.rays.clear();
    if (grade >= 2) {
      const count = grade >= 4 ? 16 : 12;
      const reach = (300 + grade * 40) * scale;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        const half = Math.PI / count * 0.45;
        this.rays.fillStyle(index % 2 === 0 ? glow : 0xffffff, 0.12 + (grade - 2) * 0.06);
        this.rays.fillTriangle(0, 0, Math.cos(angle - half) * reach, Math.sin(angle - half) * reach, Math.cos(angle + half) * reach, Math.sin(angle + half) * reach);
      }
    }
    this.twinkles.forEach((tween) => tween.remove());
    this.twinkles = [];
    this.front.removeAll(true);
    if (grade >= 3) {
      const spots = grade >= 4 ? 9 : 5;
      for (let index = 0; index < spots; index += 1) {
        const angle = -Math.PI * 0.95 + (index / Math.max(1, spots - 1)) * Math.PI * 0.9;
        const rx = 230 * scale, ry = 170 * scale;
        const sparkle = this.scene.add.graphics({ x: Math.cos(angle) * rx, y: Math.sin(angle) * ry + 30 * scale });
        drawSparkle(sparkle, 0, 0, 14 + hash01(index + grade) * 12, index % 2 ? 0xffffff : glow, 1);
        this.front.add(sparkle);
        if (chestFxMotion().loops) {
          sparkle.setAlpha(0.2);
          this.twinkles.push(this.scene.tweens.add({ targets: sparkle, alpha: 1, scale: { from: 0.6, to: 1.15 }, duration: 520 + index * 70, yoyo: true, repeat: -1, delay: index * 160, ease: "Sine.InOut" }));
        }
      }
    }
  }

  private paintGauge(value: number): void {
    const gauge = this.gauge;
    if (!gauge) return;
    const width = this.options.gaugeWidth ?? 380, height = 20, gap = 6, y = this.options.gaugeY ?? 0;
    const segments = CHEST_GRADE_THRESHOLDS.length;
    const segment = (width - gap * (segments - 1)) / segments;
    gauge.clear();
    for (let index = 0; index < segments; index += 1) {
      const from = index === 0 ? 0 : CHEST_GRADE_THRESHOLDS[index - 1];
      const to = CHEST_GRADE_THRESHOLDS[index];
      const fill = Math.max(0, Math.min(1, (value - from) / (to - from)));
      const x = -width / 2 + index * (segment + gap);
      gauge.fillStyle(0x22344f, 0.16).fillRoundedRect(x, y + 4, segment, height, height / 2);
      gauge.fillStyle(0xffffff, 0.85).fillRoundedRect(x, y, segment, height, height / 2);
      if (fill > 0) gauge.fillStyle(CHEST_GRADE_LOOKS[index + 1].glow, 1).fillRoundedRect(x, y, Math.max(height, segment * fill), height, height / 2);
      if (fill >= 1) drawSparkle(gauge, x + segment - 2, y + 1, 12, 0xffffff, 0.95);
    }
  }

  /**
   * 모은 몫의 가치를 맞춘다. 문턱을 넘어 등급이 오르면 상자가 번쩍이며 한 뼘 커지고 새 색으로 갈아입는다.
   * `quiet`이면 소리를 내지 않는다(첫 쪽의 미리보기 순환).
   */
  async setValue(value: number, options: { animate?: boolean; quiet?: boolean } = {}): Promise<void> {
    const animate = options.animate ?? true;
    const nextGrade = chestGrade(value);
    this.gaugeTween?.remove();
    if (animate && this.gauge) {
      const from = this.shown;
      this.gaugeTween = this.scene.tweens.addCounter({ from, to: value, duration: 520, ease: "Cubic.Out", onUpdate: (tween) => { this.shown = tween.getValue() ?? value; this.paintGauge(this.shown); } });
    } else {
      this.shown = value;
      this.paintGauge(value);
    }
    if (nextGrade === this.grade) return;
    const rising = nextGrade > this.grade;
    if (!animate || !rising) { this.grade = nextGrade; this.paintLook(false); return; }
    await this.gradeUp(nextGrade, options.quiet ?? false);
  }

  private async gradeUp(nextGrade: number, quiet: boolean): Promise<void> {
    const scene = this.scene, motion = chestFxMotion();
    if (!quiet) audioManager?.playUi("rune.engrave");
    const old = this.scaleFor(this.grade);
    await tweenTo(scene, { targets: this.image, scaleX: old * 0.86, scaleY: old * 1.12, duration: 110, ease: "Quad.Out" });
    this.grade = nextGrade;
    this.paintLook(false);
    const scale = this.scaleFor(nextGrade);
    this.image.setScale(scale * 1.22, scale * 0.86);
    const glow = chestGlowColor(nextGrade);
    if (motion.flash) {
      const flash = scene.add.graphics();
      flash.fillStyle(0xffffff, 0.9).fillEllipse(0, 20 * scale, 380 * scale, 300 * scale);
      this.root.addAt(flash, this.root.getIndex(this.image) + 1);
      scene.tweens.add({ targets: flash, alpha: 0, scale: 1.4, duration: 360, ease: "Cubic.Out", onComplete: () => flash.destroy() });
    }
    const ring = scene.add.graphics();
    ring.lineStyle(10, glow, 1).strokeEllipse(0, 20 * scale, 300 * scale, 220 * scale);
    this.root.addAt(ring, 1);
    scene.tweens.add({ targets: ring, scale: 1 + 0.9 * motion.distance, alpha: 0, duration: 560, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    burstSparkles(scene, this.root, 0, -20 * scale, { count: 10 + nextGrade * 3, radius: 260 * motion.distance + 60, size: 16, colors: [0xffffff, glow, 0xffe27a], seed: nextGrade * 17, rise: 40 });
    await tweenTo(scene, { targets: this.image, scaleX: scale, scaleY: scale, duration: 420, ease: "Elastic.Out", easeParams: [1.1, 0.5] });
  }

  /** 카드를 삼키는 순간 — 짜부라졌다 튀어 오르고 입구에서 반짝임이 터진다. 화려함이 클수록 크게. */
  gulp(flair: number): void {
    const scene = this.scene, motion = chestFxMotion();
    const scale = this.scaleFor(this.grade);
    const squash = 0.06 + flair * 0.025;
    scene.tweens.add({ targets: this.image, scaleX: scale * (1 + squash), scaleY: scale * (1 - squash * 1.3), duration: 90, yoyo: true, ease: "Quad.Out",
      onComplete: () => this.image.setScale(scale) });
    const mouth = this.mouth();
    burstSparkles(scene, this.root, mouth.x - this.root.x, mouth.y - this.root.y, {
      count: 5 + flair * 4, radius: (90 + flair * 45) * Math.max(0.5, motion.distance), size: 12 + flair * 3, colors: FLAIR_COLORS[flair] ?? FLAIR_COLORS[0], seed: flair * 31 + 7, rise: 50,
    });
    audioManager?.playUi(flair >= 3 ? "rune.success" : "augment.lock");
  }

  /** 다 모은 뒤 — 부들부들 세 번 떨다가 뚜껑이 열리며 빛이 터지고, 모은 보상이 하나씩 튀어나온다. */
  async open(items: readonly { texture: string }[], targetY: number, grow: number): Promise<void> {
    const scene = this.scene, motion = chestFxMotion();
    this.gaugeTween?.remove();
    if (this.gauge) scene.tweens.add({ targets: this.gauge, alpha: 0, duration: 200 });
    const scale = this.scaleFor(this.grade);
    const big = scale * grow;
    await tweenTo(scene, { targets: this.root, y: targetY, duration: 380, ease: "Cubic.InOut" });
    await tweenTo(scene, { targets: this.image, scale: big, duration: 220, ease: "Back.Out" });
    for (let shake = 1; shake <= 3; shake += 1) {
      audioManager?.playUi("roulette.tick");
      const swing = (2 + shake * 2.2) * motion.distance;
      this.aura.setAlpha(1 + shake * 0.25);
      burstSparkles(scene, this.root, 0, 0, { count: 4 + shake * 2, radius: 180 + shake * 30, size: 10, colors: [0xffffff, chestGlowColor(this.grade)], seed: shake * 13, duration: 360 });
      await tweenTo(scene, { targets: this.image, angle: { from: -swing, to: swing }, duration: 55, yoyo: true, repeat: 2, ease: "Sine.InOut" });
      this.image.setAngle(0);
      await waitFx(scene, Math.max(60, 220 - shake * 60));
    }
    // 펑 — 열린 그림으로 갈아 끼운다.
    this.opened = true;
    this.paintLook(true);
    this.image.setScale(big * 1.25, big * 0.8);
    audioManager?.playUi("ui.breakthrough");
    if (this.grade >= 3) scene.time.delayedCall(260, () => audioManager?.playUi("success.fanfare"));
    if (motion.shake > 0) scene.cameras.main.shake(220, 0.006 * motion.shake);
    const glow = chestGlowColor(this.grade);
    if (motion.flash) {
      const flash = scene.add.graphics();
      flash.fillStyle(0xffffff, 1).fillEllipse(0, 0, 520 * big, 420 * big);
      this.root.add(flash);
      scene.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 520, ease: "Cubic.Out", onComplete: () => flash.destroy() });
    }
    this.rays.setAlpha(1);
    if (this.grade < 2) {
      // 낮은 등급도 열리는 순간만은 햇살이 한 번 퍼진다.
      const burst = scene.add.graphics();
      for (let index = 0; index < 12; index += 1) {
        const angle = (index / 12) * Math.PI * 2, half = Math.PI / 12 * 0.4, reach = 420 * big;
        burst.fillStyle(index % 2 ? 0xffffff : glow, 0.4).fillTriangle(0, 0, Math.cos(angle - half) * reach, Math.sin(angle - half) * reach, Math.cos(angle + half) * reach, Math.sin(angle + half) * reach);
      }
      this.root.addAt(burst, 1);
      scene.tweens.add({ targets: burst, alpha: 0, angle: 40, duration: 900, ease: "Cubic.Out", onComplete: () => burst.destroy() });
    }
    burstSparkles(scene, this.root, 0, -120 * big, { count: 16 + this.grade * 5, radius: 360 * Math.max(0.5, motion.distance), size: 18, colors: FLAIR_COLORS[Math.min(4, this.grade)], seed: 99, rise: 80, duration: 800 });
    scene.tweens.add({ targets: this.image, scaleX: big, scaleY: big, duration: 520, ease: "Elastic.Out", easeParams: [1.1, 0.45] });
    // 모은 보상이 상자 안에서 위로 튀어나와 부채꼴로 선다.
    const mouthY = (CHEST_ART_CONTENT.open.top + 120 - CHEST_ART.height / 2) * big;
    items.forEach((item, index) => {
      const icon = scene.add.image(0, mouthY, item.texture).setDisplaySize(30, 30).setAlpha(0);
      this.root.add(icon);
      const spread = (index - (items.length - 1) / 2);
      const x = spread * 112, y = mouthY - 210 - Math.abs(spread) * -18;
      scene.tweens.add({ targets: icon, alpha: 1, x, y, displayWidth: 104, displayHeight: 104, duration: 460, delay: 180 + index * 110, ease: "Back.Out",
        onComplete: () => { if (motion.loops) scene.tweens.add({ targets: icon, y: y - 10, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" }); } });
    });
    await waitFx(scene, 700 + items.length * 110);
  }

  /** 아무것도 모으지 못했을 때 — 열지 않고 힘없이 주저앉는다. */
  async fizzle(): Promise<void> {
    const scene = this.scene;
    audioManager?.playUi("rune.fail");
    const scale = this.scaleFor(this.grade);
    burstSparkles(scene, this.root, 0, 60 * scale, { count: 8, radius: 160, size: 12, colors: [0xc9bfbb, 0xe6dfdc], seed: 5, duration: 600 });
    await tweenTo(scene, { targets: this.image, scaleX: scale * 1.08, scaleY: scale * 0.9, duration: 160, yoyo: true, ease: "Quad.Out" });
    await waitFx(scene, 420);
  }

  destroy(): void {
    this.twinkles.forEach((tween) => tween.remove());
    this.gaugeTween?.remove();
    this.scene.tweens.killTweensOf([this.rays, this.image, this.root, this.aura]);
    this.root.destroy(true);
  }
}

/** 카드를 집어 든다 — 떠올라 부르르 떨며 등급 빛이 모인다(지이이잉). */
export async function chargeCard(scene: Phaser.Scene, row: Phaser.GameObjects.Container, holder: Phaser.GameObjects.Container,
  width: number, height: number, tone: number, flair: number): Promise<Phaser.GameObjects.Graphics> {
  const motion = chestFxMotion();
  const glow = scene.add.graphics({ x: holder.x, y: holder.y });
  for (let ring = 4; ring > 0; ring -= 1) glow.fillStyle(tone, 0.16).fillRoundedRect(-width / 2 - ring * 12, -height / 2 - ring * 12, width + ring * 24, height + ring * 24, 30 + ring * 10);
  glow.setAlpha(0).setScale(0.9);
  row.addAt(glow, row.getIndex(holder));
  audioManager?.playUi("settle.lift");
  const lift = -36 * motion.distance;
  scene.tweens.add({ targets: [holder, glow], y: lift, duration: 170, ease: "Back.Out" });
  scene.tweens.add({ targets: holder, scale: 1.1, duration: 170, ease: "Back.Out" });
  scene.tweens.add({ targets: glow, alpha: 1, scale: 1.12, duration: 520, ease: "Sine.In" });
  // 빛 조각이 사방에서 카드로 빨려 든다.
  const pull = 6 + flair * 2;
  for (let index = 0; index < pull; index += 1) {
    const angle = (index / pull) * Math.PI * 2 + 0.3;
    const reach = 190 + hash01(index + flair) * 60;
    const sparkle = scene.add.graphics({ x: holder.x + Math.cos(angle) * reach, y: lift + Math.sin(angle) * reach });
    drawSparkle(sparkle, 0, 0, 9 + hash01(index * 3) * 6, index % 2 ? 0xffffff : tone, 1);
    sparkle.setAlpha(0);
    row.add(sparkle);
    scene.tweens.add({ targets: sparkle, x: holder.x, y: lift, alpha: { from: 0.2, to: 1 }, scale: { from: 1, to: 0.3 }, duration: 420, delay: 80 + index * 30, ease: "Cubic.In", onComplete: () => sparkle.destroy() });
  }
  await waitFx(scene, 170);
  const baseX = holder.x;
  await tweenTo(scene, { targets: holder, x: { from: baseX - 4 * motion.distance, to: baseX + 4 * motion.distance }, duration: 28, yoyo: true, repeat: 7, ease: "Sine.InOut" });
  holder.setX(baseX);
  return glow;
}

/** 뒤집기(핑!) — 좁아졌다가 결과 면으로 넓어지며 하얗게 번쩍인다. */
export async function flipCard(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, width: number, height: number,
  repaint: () => void, success: boolean): Promise<void> {
  const motion = chestFxMotion();
  await tweenTo(scene, { targets: holder, scaleX: 0, duration: 90, ease: "Sine.In" });
  repaint();
  audioManager?.playUi(success ? "rune.success" : "rune.fail");
  if (motion.flash) {
    const flash = scene.add.graphics();
    flash.fillStyle(0xffffff, 1).fillRoundedRect(-width / 2, -height / 2, width, height, 26);
    holder.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 260, ease: "Cubic.Out", onComplete: () => flash.destroy() });
  }
  await tweenTo(scene, { targets: holder, scaleX: success ? 1.14 : 1.04, scaleY: success ? 1.14 : 1.04, duration: 180, ease: "Back.Out" });
}

/** 도장(쾅!) — 크게 떠 있다가 내려찍히며 먼지가 튀고 카드가 움찔한다. */
export async function stampCard(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, width: number, success: boolean, label: string, flair: number): Promise<void> {
  const motion = chestFxMotion();
  const ink = success ? (flair >= 3 ? 0xd9930b : 0xe0483a) : 0x6f7480;
  const stampWidth = width * 0.9, stampHeight = 96;
  const stamp = scene.add.container(0, 18).setAngle(success ? -14 : 12);
  const face = scene.add.graphics();
  face.fillStyle(0xffffff, 0.82).fillRoundedRect(-stampWidth / 2, -stampHeight / 2, stampWidth, stampHeight, 18);
  face.lineStyle(7, ink, 1).strokeRoundedRect(-stampWidth / 2, -stampHeight / 2, stampWidth, stampHeight, 18);
  face.lineStyle(2.5, ink, 1).strokeRoundedRect(-stampWidth / 2 + 10, -stampHeight / 2 + 10, stampWidth - 20, stampHeight - 20, 12);
  const text = scene.add.text(0, 0, label, textStyle({ role: "display", size: 46, color: `#${ink.toString(16).padStart(6, "0")}` })).setOrigin(0.5);
  shrinkTextToWidth(text, stampWidth - 36, { minSize: 22 });
  stamp.add([face, text]);
  stamp.setScale(2.6).setAlpha(0);
  holder.add(stamp);
  await tweenTo(scene, { targets: stamp, scale: 1, alpha: 1, duration: 120, ease: "Quad.In" });
  audioManager?.playUi("attendance.stamp");
  if (motion.shake > 0) scene.cameras.main.shake(success ? 110 + flair * 25 : 140, (success ? 0.0035 + flair * 0.0012 : 0.005) * motion.shake);
  // 먼지 — 도장 둘레로 짧게 퍼진다.
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const puff = scene.add.graphics({ x: Math.cos(angle) * stampWidth * 0.42, y: 18 + Math.sin(angle) * stampHeight * 0.5 });
    puff.fillStyle(success ? 0xffffff : 0xd9d2cf, 0.9).fillCircle(0, 0, 9 + hash01(index) * 6);
    holder.add(puff);
    scene.tweens.add({ targets: puff, x: puff.x * 1.6, y: 18 + (puff.y - 18) * 1.7, alpha: 0, scale: 1.6, duration: 360, ease: "Cubic.Out", onComplete: () => puff.destroy() });
  }
  const base = holder.scaleX;
  await tweenTo(scene, { targets: holder, scaleX: base * 0.93, scaleY: base * 0.93, duration: 60, yoyo: true, ease: "Quad.Out" });
}

/** 실패 카드가 파사삭 깨진다 — 카드를 조각으로 갈라 사방으로 흩고 떨어뜨린다. */
export async function shatterCard(scene: Phaser.Scene, row: Phaser.GameObjects.Container, holder: Phaser.GameObjects.Container, width: number, height: number): Promise<void> {
  const motion = chestFxMotion();
  const cx = holder.x, cy = holder.y, scale = holder.scaleX;
  const cols = 3, rows = 4;
  const cellW = width * scale / cols, cellH = height * scale / rows;
  audioManager?.playSfx("research.shatter");
  holder.setVisible(false);
  const jitter = (seed: number, size: number): number => (hash01(seed) - 0.5) * size * 0.5;
  const corner = (col: number, rowIndex: number): [number, number] => {
    const edge = col === 0 || col === cols || rowIndex === 0 || rowIndex === rows;
    const x = -width * scale / 2 + col * cellW + (edge ? 0 : jitter(col * 13 + rowIndex, cellW));
    const y = -height * scale / 2 + rowIndex * cellH + (edge ? 0 : jitter(col * 7 + rowIndex * 3, cellH));
    return [x, y];
  };
  const shards: Promise<void>[] = [];
  let seed = 0;
  for (let col = 0; col < cols; col += 1) for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const a = corner(col, rowIndex), b = corner(col + 1, rowIndex), c = corner(col + 1, rowIndex + 1), d = corner(col, rowIndex + 1);
    for (const tri of [[a, b, c], [a, c, d]] as const) {
      seed += 1;
      const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const shard = scene.add.graphics({ x: cx + mx, y: cy + my });
      const pts = tri.map(([x, y]) => new Phaser.Math.Vector2(x - mx, y - my));
      shard.fillStyle(seed % 3 === 0 ? 0xbfb6b2 : 0xd8d2cf, 1).fillPoints(pts, true);
      shard.lineStyle(3, 0x9a8f8c, 1).strokePoints(pts, true, true);
      row.add(shard);
      const length = Math.hypot(mx, my) || 1;
      const push = (70 + hash01(seed * 5) * 120) * Math.max(0.5, motion.distance);
      const tx = cx + mx + (mx / length) * push, ty = cy + my + (my / length) * push * 0.6;
      shards.push(new Promise((resolve) => {
        scene.tweens.addCounter({ from: 0, to: 1, duration: 620 + hash01(seed) * 200, ease: "Linear", onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          const outT = 1 - (1 - t) * (1 - t);
          shard.setPosition(cx + mx + (tx - cx - mx) * outT, cy + my + (ty - cy - my) * outT + 260 * t * t * motion.distance);
          shard.setAngle((hash01(seed * 9) - 0.5) * 360 * t);
          shard.setAlpha(1 - Math.max(0, t - 0.55) / 0.45);
        }, onComplete: () => { shard.destroy(); resolve(); } });
      }));
    }
  }
  burstSparkles(scene, row, cx, cy, { count: 10, radius: 150, size: 10, colors: [0xffffff, 0xd8d2cf], seed: 71, duration: 420 });
  await Promise.all(shards);
}

/** 성공 카드가 상자 입구로 날아 들어간다 — 화려할수록 오래 돌고 반짝이 꼬리가 길다. 도착하면 카드는 사라진다. */
export async function flyCardToChest(scene: Phaser.Scene, page: Phaser.GameObjects.Container, holder: Phaser.GameObjects.Container,
  from: { x: number; y: number }, to: { x: number; y: number }, flair: number): Promise<void> {
  const motion = chestFxMotion();
  page.add(holder);
  holder.setPosition(from.x, from.y);
  const colors = FLAIR_COLORS[flair] ?? FLAIR_COLORS[0];
  if (flair >= 3) {
    // 대형·대박 — 날아가기 전에 한 번 크게 빛난다.
    if (flair >= 4) audioManager?.playUi("success.fanfare");
    const rays = scene.add.graphics({ x: from.x, y: from.y });
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2, half = Math.PI / 14 * 0.45, reach = 260 + flair * 40;
      rays.fillStyle(index % 2 ? 0xffffff : 0xffe27a, 0.5).fillTriangle(0, 0, Math.cos(angle - half) * reach, Math.sin(angle - half) * reach, Math.cos(angle + half) * reach, Math.sin(angle + half) * reach);
    }
    page.addAt(rays, page.getIndex(holder));
    rays.setScale(0.3);
    scene.tweens.add({ targets: rays, scale: 1, angle: 50, alpha: { from: 1, to: 0 }, duration: 760, ease: "Cubic.Out", onComplete: () => rays.destroy() });
    if (flair >= 4 && motion.flash) {
      const flash = scene.add.rectangle(0, 0, 2400, 3200, 0xfff6d0, 0.85);
      page.add(flash);
      scene.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => flash.destroy() });
    }
    burstSparkles(scene, page, from.x, from.y, { count: 10 + flair * 3, radius: 200, size: 16, colors, seed: 41, rise: 30 });
    await tweenTo(scene, { targets: holder, scale: holder.scaleX * 1.12, duration: 160, yoyo: true, hold: 160, ease: "Back.Out" });
  } else {
    await waitFx(scene, 220);
  }
  const startScale = holder.scaleX;
  const side = from.x === to.x ? 120 : Math.sign(from.x - to.x) * 160;
  const control = { x: (from.x + to.x) / 2 + side, y: Math.min(from.y, to.y) - 40 };
  const spin = flair >= 2 ? 360 + flair * 90 : 200;
  const direction = from.x > to.x ? -1 : 1;
  const trailEvery = flair >= 4 ? 24 : flair >= 2 ? 40 : flair >= 1 ? 70 : 0;
  let lastTrail = 0, trailIndex = 0;
  await new Promise<void>((resolve) => {
    scene.tweens.addCounter({ from: 0, to: 1, duration: 460 + flair * 70, ease: "Sine.InOut", onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
      holder.setPosition(x, y).setScale(startScale + (0.14 - startScale) * t).setAngle(direction * spin * t);
      if (t > 0.86) holder.setAlpha(1 - (t - 0.86) / 0.14);
      const elapsed = tween.elapsed;
      if (trailEvery > 0 && elapsed - lastTrail >= trailEvery && t < 0.95) {
        lastTrail = elapsed;
        trailIndex += 1;
        const sparkle = scene.add.graphics({ x, y });
        drawSparkle(sparkle, 0, 0, 8 + flair * 3 + hash01(trailIndex) * 6, colors[trailIndex % colors.length], 1);
        page.addAt(sparkle, page.getIndex(holder));
        scene.tweens.add({ targets: sparkle, alpha: 0, scale: 0.2, y: y + 20, angle: 90, duration: 380 + flair * 60, ease: "Quad.Out", onComplete: () => sparkle.destroy() });
      }
    }, onComplete: () => resolve() });
  });
  holder.destroy();
}

export { CHEST_GRADE_MAX };
