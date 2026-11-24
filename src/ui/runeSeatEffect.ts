import Phaser from "phaser";
import { audioManager } from "../managers/AudioManager";
import { session } from "../state/session";
import { burstDiamond } from "./breakthroughBurst";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { toPoints } from "./holo";
import { RUNE_SEAT_FX, runeSeatSparkVector, type RuneSeatChange } from "./runeSeatEffectStyle";

/** 하트 조각 한 칸에 끼움·교체·빼기 연출을 돌리는 데 드는 것들. */
export interface RuneSeatEffectInput {
  readonly kind: RuneSeatChange;
  /** 연출 조각을 얹을 층(하트 판과 같은 층). */
  readonly layer: Phaser.GameObjects.Container;
  /** 조각이 박히는 자리와 하트 가운데에서 그 자리로 향하는 단위 벡터. */
  readonly x: number;
  readonly y: number;
  readonly outward: { readonly x: number; readonly y: number };
  /** 조각 한 변(표시 크기)과 그림의 세로 기준(`RUNE_CENTER_Y`). */
  readonly size: number;
  readonly originY: number;
  /** 빠지는 옛 조각의 그림(교체·빼기) — 등급 색이 구워진 조각 그림이다. */
  readonly oldTexture?: string;
  /** 새 조각을 이루는 그림들(테·빛·몸) — 연출이 바깥에서 끌어와 제자리에 박는다(끼움·교체). */
  readonly pieces?: readonly Phaser.GameObjects.Image[];
  /** 새 조각의 몸 그림 키와 등급 색 — 섬광·파문·파편의 색. */
  readonly newTexture?: string;
  readonly color: number;
}

/**
 * 한 칸의 연출을 돌린다. 만든 조각은 모두 스스로 사라지고, 층이 먼저 걷히면(창을 닫음) 트윈도 함께 끊긴다.
 */
export function playRuneSeatEffect(scene: Phaser.Scene, input: RuneSeatEffectInput): void {
  const F = RUNE_SEAT_FX;
  const reduced = session.settings.accessibility.reduceMotion;
  const { layer, x, y, outward } = input;
  const alive = (): boolean => layer.active && scene.sys.isActive();

  // ── 빠지는 옛 조각 ──────────────────────────────────────────────────
  if ((input.kind === "swap" || input.kind === "remove") && input.oldTexture) {
    audioManager?.playUi("equip.off");
    const ghost = scene.add.image(x, y, input.oldTexture).setOrigin(0.5, input.originY).setDisplaySize(input.size, input.size);
    layer.add(ghost);
    const sx = ghost.scaleX;
    const sy = ghost.scaleY;
    scene.tweens.add({
      targets: ghost,
      x: x + outward.x * (reduced ? 0 : F.eject.distance),
      y: y + outward.y * (reduced ? 0 : F.eject.distance),
      scaleX: sx * F.eject.scale, scaleY: sy * F.eject.scale,
      angle: reduced ? 0 : (outward.x >= 0 ? F.eject.spin : -F.eject.spin),
      alpha: 0, duration: F.eject.duration, ease: "Cubic.easeIn",
      onComplete: () => ghost.destroy(),
    });
  }
  if (input.kind === "remove" || !input.pieces || input.pieces.length === 0) return;

  // ── 들어오는 새 조각 ────────────────────────────────────────────────
  // 몸·테·빛을 한 덩어리로 옮긴다 — 저마다의 제자리·투명도·배율을 기억해 두고 카운터 트윈 하나가 함께 민다.
  const finals = input.pieces.map((image) => ({ image, x: image.x, y: image.y, alpha: image.alpha, sx: image.scaleX, sy: image.scaleY }));
  const offX = outward.x * F.insert.distance;
  const offY = outward.y * F.insert.distance;
  const place = (progress: number, squash = 1): void => {
    const rest = 1 - progress;
    const grow = reduced ? squash : (1 + (F.insert.fromScale - 1) * rest) * squash;
    for (const f of finals) {
      if (!f.image.active) continue;
      f.image.setPosition(f.x + (reduced ? 0 : offX * rest), f.y + (reduced ? 0 : offY * rest));
      f.image.setScale(f.sx * grow, f.sy * grow);
      f.image.setAlpha(f.alpha * progress);
    }
  };
  place(0);
  const delay = input.kind === "swap" ? F.insert.swapDelay : 0;
  scene.tweens.addCounter({
    from: 0, to: 1, duration: F.insert.duration, delay, ease: "Quad.easeIn",
    onUpdate: (tween) => { if (alive()) place(tween.getValue() ?? 1); },
    onComplete: () => {
      if (!alive()) return;
      place(1);
      land();
    },
  });

  const land = (): void => {
    audioManager?.playUi("equip.on");
    ensureEffectTextures(scene);
    // 박히며 한 번 눌렸다 돌아온다.
    if (!reduced) {
      scene.tweens.addCounter({
        from: F.settle.squash, to: 1, duration: F.settle.duration, ease: "Back.easeOut",
        onUpdate: (tween) => { if (alive()) place(1, tween.getValue() ?? 1); },
        onComplete: () => { if (alive()) place(1); },
      });
    }
    // 조각 모양 그대로의 섬광.
    if (input.newTexture) {
      const flash = scene.add.image(x, y, input.newTexture).setOrigin(0.5, input.originY).setDisplaySize(input.size, input.size)
        .setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(F.flash.alpha);
      layer.add(flash);
      const fx = flash.scaleX;
      const fy = flash.scaleY;
      scene.tweens.add({
        targets: flash, alpha: 0, scaleX: fx * F.flash.grow, scaleY: fy * F.flash.grow,
        duration: F.flash.duration, ease: "Cubic.easeOut", onComplete: () => flash.destroy(),
      });
    }
    if (reduced) return;
    // 납작한 마름모 파문 한 겹 — 한 번 그려 두고 배율만 키운다(매 프레임 다시 그리지 않는다).
    const ripple = scene.add.graphics({ x: x + outward.x * input.size * 0.08, y: y + outward.y * input.size * 0.08 });
    ripple.lineStyle(F.ripple.thickness, input.color, F.ripple.alpha);
    ripple.strokePoints(toPoints(burstDiamond(input.size * F.ripple.to, F.ripple.squash)), true);
    ripple.setScale(F.ripple.from / F.ripple.to);
    layer.add(ripple);
    scene.tweens.add({ targets: ripple, scale: 1, alpha: 0, duration: F.ripple.duration, ease: "Cubic.easeOut", onComplete: () => ripple.destroy() });
    // 바깥으로 튀는 작은 마름모.
    for (let index = 0; index < F.spark.count; index += 1) {
      const v = runeSeatSparkVector(index, F.spark.count, outward);
      const spark = scene.add.image(x, y, EFFECT_TEXTURE.shard).setTint(input.color).setDisplaySize(F.spark.size, F.spark.size).setBlendMode(Phaser.BlendModes.ADD);
      layer.add(spark);
      scene.tweens.add({
        targets: spark, x: x + v.x * F.spark.distance, y: y + v.y * F.spark.distance,
        alpha: 0, scale: spark.scale * 0.3, angle: v.x * 90,
        duration: F.spark.duration, ease: "Cubic.easeOut", onComplete: () => spark.destroy(),
      });
    }
  };
}

/** 옆 글 판이 새 값으로 한 번 밝아진다(끼움·교체·빼기 모두). */
export function playRuneSeatPlate(scene: Phaser.Scene, block: Phaser.GameObjects.Container, delay: number): void {
  const F = RUNE_SEAT_FX.plate;
  block.setAlpha(F.fromAlpha);
  scene.tweens.add({ targets: block, alpha: 1, duration: F.duration, delay, ease: "Sine.easeOut" });
}

/** 후보를 고른 순간 — 비교 판의 후보 그림이 톡 튄다. 장착음보다 가벼운 소리다. */
export function playRunePick(scene: Phaser.Scene, icon: Phaser.GameObjects.Container): void {
  audioManager?.playUi("formation.place");
  if (session.settings.accessibility.reduceMotion) return;
  const F = RUNE_SEAT_FX.pick;
  const sx = icon.scaleX;
  const sy = icon.scaleY;
  icon.setScale(sx * F.fromScale, sy * F.fromScale);
  scene.tweens.add({ targets: icon, scaleX: sx, scaleY: sy, duration: F.duration, ease: "Back.easeOut" });
}
