/**
 * 「에이 SR이네~ … 팅!」 — 10연 마지막 칸이 SR에서 SSR로 한 번 더 오르는 깜짝 연출.
 *
 * 카드는 처음부터 보라빛 SR로 서고, 한동안 아무 일도 일어나지 않는다. 숨이 멎고 금이 가며 떨리다가
 * 한 번에 황금빛으로 터진다. 자리와 박자는 `rarityUpgradeLayout.ts`가 갖는다.
 *
 * - **터지기 전의 누름은 받지 않는다.** 건너뛰기를 눌러 이 장면에 닿아도 깜짝이 삼켜지면 안 된다.
 * - 섬광은 `flashPolicy`를 지나고 흔들림은 움직임 줄이기를 따른다.
 * - 조각은 동그라미가 아니라 마름모이고 위로 튄다(난수 없이 번호에서 정한다).
 *
 * 닫힐 때까지 기다린다. 씬이 도중에 내려가면 그 자리에서 끝난다.
 */

import Phaser from "phaser";
import { CRACK_BRANCHES, crackBranchPoints, fossilShards, shardPoints } from "./fossilCrack";
import { chipPoints, drawVignette, toPoints } from "./holo";
import { RARITY_TONE } from "./rarityMark";
import { flashPolicy } from "./signatureEffects";
import { COLOR, textStyle } from "./theme";
import {
  RARITY_UPGRADE_CARD,
  RARITY_UPGRADE_REDUCED_RATIO,
  RARITY_UPGRADE_SIZE,
  RARITY_UPGRADE_TAP_LOCK_MS,
  RARITY_UPGRADE_TIMELINE,
} from "./rarityUpgradeLayout";

export interface RarityUpgradeOptions {
  depth: number;
  reduceMotion: boolean;
  reduceFlashes: boolean;
}

const W = RARITY_UPGRADE_SIZE.width;
const H = RARITY_UPGRADE_SIZE.height;
const OVERSCAN = 64;
const CARD = RARITY_UPGRADE_CARD;

function hex(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

/** 카드 한 장을 칩 실루엣으로 칠한다. 큰 면 → 안쪽 어둠 → 안쪽 빛 순이라 테두리 선 없이 깊이가 선다. */
function paintCard(g: Phaser.GameObjects.Graphics, rarity: "SR" | "SSR"): void {
  const tone = RARITY_TONE[rarity];
  g.clear();
  const bevel = { topLeft: CARD.bevel, bottomRight: CARD.bevel };
  g.fillStyle(tone.chip, 0.95);
  g.fillPoints(toPoints(chipPoints(CARD.width, CARD.height, { bevel })), true);
  g.fillStyle(COLOR.void, 0.58);
  g.fillPoints(toPoints(chipPoints(CARD.width - 44, CARD.height - 44, { bevel: CARD.bevel * 0.8 })), true);
  g.fillStyle(hex(tone.halo), 0.14);
  g.fillPoints(toPoints(chipPoints(CARD.width - 120, CARD.height - 120, { bevel: CARD.bevel * 0.6 })), true);
}

export function playRarityUpgrade(scene: Phaser.Scene, options: RarityUpgradeOptions): Promise<void> {
  return new Promise<void>((resolve) => new RarityUpgradeReveal(scene, options, resolve));
}

class RarityUpgradeReveal {
  private readonly root: Phaser.GameObjects.Container;
  private readonly card: Phaser.GameObjects.Container;
  private readonly cardArt: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly crack: Phaser.GameObjects.Graphics;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly tweens: Phaser.Tweens.Tween[] = [];
  private readonly extras: Phaser.GameObjects.GameObject[] = [];
  private tapAt = Number.POSITIVE_INFINITY;
  private finished = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: RarityUpgradeOptions,
    private readonly resolve: () => void,
  ) {
    const { depth } = options;
    const ratio = options.reduceMotion ? RARITY_UPGRADE_REDUCED_RATIO : 1;
    const T = RARITY_UPGRADE_TIMELINE;
    const root = scene.add.container(0, 0).setDepth(depth).setAlpha(0);
    this.root = root;

    // 손을 받는 어둠. 터지기 전에는 누름을 삼키기만 하고, 터진 뒤 잠금이 풀리면 닫는다.
    this.shade = scene.add.rectangle(W / 2, H / 2, W + OVERSCAN * 2, H + OVERSCAN * 2, COLOR.void, 0.94).setInteractive();
    this.shade.on("pointerup", () => { if (performance.now() >= this.tapAt) this.leave(); });
    const vignette = drawVignette(scene, W + OVERSCAN * 2, H + OVERSCAN * 2, { strength: 0.9, depth: 0 }).setPosition(-OVERSCAN, -OVERSCAN);

    this.card = scene.add.container(CARD.x, CARD.y);
    this.cardArt = scene.add.graphics();
    paintCard(this.cardArt, "SR");
    const sr = RARITY_TONE.SR;
    this.label = scene.add.text(0, -20, "SR", textStyle({ role: "display", size: 168, color: sr.ink }))
      .setOrigin(0.5).setStroke("#2a0a36", 12).setShadow(0, 0, sr.halo, 26, true, true);
    this.crack = scene.add.graphics();
    this.crack.setAlpha(0);
    this.card.add([this.cardArt, this.label, this.crack]);
    root.add([this.shade, vignette, this.card]);
    this.extras.push(root);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.finish());

    // ── 막 1·2: 보라빛 SR이 서서 숨 쉰다. ───────────────────────────────────────────
    this.card.setScale(0.92).setAlpha(0.9);
    this.track({ targets: root, alpha: 1, duration: T.settle * ratio });
    this.track({ targets: this.card, scale: 1, duration: T.settle * ratio, ease: "Sine.easeOut" });
    const calmEnd = (T.settle + T.calm) * ratio;
    const calmBreath = this.track({ targets: this.card, scale: 1.025, duration: 640 * ratio + 160, yoyo: true, repeat: 1, delay: T.settle * ratio, ease: "Sine.easeInOut" });
    void calmBreath;

    // ── 막 3: 숨이 멎는다 — 카드가 가라앉고 어둠이 한 번 더 깊어진다. ────────────────────
    const hushStart = calmEnd;
    this.track({ targets: this.card, alpha: 0.72, scale: 0.985, duration: T.hush * ratio, delay: hushStart, ease: "Sine.easeIn" });
    this.track({ targets: this.shade, fillAlpha: 0.995, duration: T.hush * ratio, delay: hushStart });
    this.track({ targets: this.label, alpha: 0.55, duration: T.hush * ratio, delay: hushStart });

    // ── 막 4: 금이 번지고 카드가 떨린다. ────────────────────────────────────────────
    const tremorStart = hushStart + T.hush * ratio;
    const tremorLen = T.tremor * ratio;
    this.drawCrack();
    this.track({ targets: this.crack, alpha: 1, duration: tremorLen * 0.8, delay: tremorStart, ease: "Cubic.easeIn" });
    this.track({ targets: this.label, alpha: 1, duration: tremorLen, delay: tremorStart });
    if (!options.reduceMotion) {
      // 떨림은 점점 잦아진다 — 간격이 줄어드는 세 토막.
      let at = tremorStart;
      for (const [step, swing] of [[90, 3], [64, 5], [42, 8], [30, 11]] as const) {
        const repeats = Math.max(1, Math.floor((tremorLen / 4) / step / 2));
        this.track({ targets: this.card, x: CARD.x + swing, duration: step, yoyo: true, repeat: repeats * 2 - 1, delay: at });
        at += repeats * step * 2;
      }
    }

    // ── 막 5: 팅! ──────────────────────────────────────────────────────────────────
    const tingAt = tremorStart + tremorLen;
    scene.tweens.addCounter({ from: 0, to: 1, duration: Math.max(1, tingAt), onComplete: () => this.ting() });
  }

  private track(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add(config);
    this.tweens.push(tween);
    return tween;
  }

  private drawCrack(): void {
    const tone = RARITY_TONE.SSR;
    this.crack.lineStyle(10, hex(tone.halo), 1);
    for (const branch of CRACK_BRANCHES) this.crack.strokePoints(toPoints(crackBranchPoints(branch, CARD.height * 0.92)), false);
  }

  /** 터지는 순간 — 색이 한 번에 바뀌고 글자가 튀어나오며 조각이 위로 흩어진다. */
  private ting(): void {
    if (this.finished) return;
    const { scene, options } = this;
    // 누름 잠금은 터진 실제 시각에서 잰다 — 느린 기기에서는 장면 시계가 실제 시간보다 느려, 미리 셈해 두면 터지기 전에 풀린다.
    this.tapAt = performance.now() + RARITY_UPGRADE_TAP_LOCK_MS;
    const tone = RARITY_TONE.SSR;
    const flash = flashPolicy(options.reduceFlashes);
    for (const tween of this.tweens) tween.stop();
    this.card.setPosition(CARD.x, CARD.y).setAlpha(1).setScale(1);
    this.shade.setFillStyle(COLOR.void, 0.94);
    paintCard(this.cardArt, "SSR");
    this.crack.setAlpha(0);
    this.label.setText("SSR").setColor(tone.ink).setAlpha(1).setStroke("#4a2a00", 14).setShadow(0, 0, tone.halo, 34, true, true);
    this.label.setScale(options.reduceMotion ? 1 : 2.2);

    // 섬광 — 겹쳐 밝아지는 합성이라 옅게, 감소 설정에서는 더 옅게.
    const flashLayer = scene.add.rectangle(W / 2, H / 2, W + OVERSCAN * 2, H + OVERSCAN * 2, hex(tone.halo), 0.6 * flash.alphaRatio)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.root.add(flashLayer);
    scene.tweens.add({ targets: flashLayer, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => flashLayer.destroy() });

    if (!options.reduceMotion) {
      scene.tweens.add({ targets: this.label, scale: 1, duration: RARITY_UPGRADE_TIMELINE.ting + 120, ease: "Back.easeOut" });
      scene.cameras.main.shake(380, 0.014);
      // 카드가 한 번 튄다.
      scene.tweens.add({ targets: this.card, scale: 1.07, duration: 120, yoyo: true, ease: "Quad.easeOut" });
    }

    // 납작한 마름모 파문 두 겹 — 동그라미를 쓰지 않는다.
    for (const [delay, grow] of [[0, 3.1], [110, 2.3]] as const) {
      const ripple = scene.add.graphics({ x: CARD.x, y: CARD.y }).setBlendMode(Phaser.BlendModes.ADD);
      ripple.fillStyle(hex(tone.halo), 0.22 * flash.alphaRatio);
      ripple.fillPoints(toPoints([0, -120, 220, 0, 0, 120, -220, 0]), true);
      ripple.setScale(0.3, 0.3).setAlpha(0);
      this.root.add(ripple);
      scene.tweens.add({ targets: ripple, scaleX: grow, scaleY: grow * 0.5, alpha: { from: 1, to: 0 }, duration: 620, delay, ease: "Cubic.easeOut", onComplete: () => ripple.destroy() });
    }

    // 조각 — 마름모, 위로 튄다.
    for (const shard of fossilShards(16, 520, 34)) {
      const piece = scene.add.graphics({ x: CARD.x, y: CARD.y });
      piece.fillStyle(hex(tone.halo), 1);
      piece.fillPoints(toPoints(shardPoints(shard.size)), true);
      this.root.add(piece);
      const lift = options.reduceMotion ? 0.4 : 1;
      scene.tweens.add({
        targets: piece,
        x: CARD.x + Math.cos(shard.angle) * shard.distance * lift,
        y: CARD.y + Math.sin(shard.angle) * shard.distance * lift - 40,
        angle: shard.spin,
        alpha: { from: 1, to: 0 },
        duration: 760,
        ease: "Cubic.easeOut",
        onComplete: () => piece.destroy(),
      });
    }

    // 머문 뒤 스스로 닫힌다. 누르면 잠금이 풀린 뒤 곧바로 닫힌다.
    scene.tweens.addCounter({ from: 0, to: 1, duration: RARITY_UPGRADE_TIMELINE.ting + RARITY_UPGRADE_TIMELINE.hold, onComplete: () => this.leave() });
  }

  private leave(): void {
    if (this.finished) return;
    this.tapAt = Number.POSITIVE_INFINITY;
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: RARITY_UPGRADE_TIMELINE.leave, onComplete: () => this.finish() });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const tween of this.tweens) tween.stop();
    for (const object of this.extras) object.destroy();
    this.resolve();
  }
}
