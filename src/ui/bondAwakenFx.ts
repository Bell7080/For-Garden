import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { breakthroughShardVector, burstDiamond } from "./breakthroughBurst";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { drawGlyph } from "./glyphs";
import { toPoints } from "./holo";
import { shakeCamera } from "./screenShake";
import { textStyle } from "./theme";

/**
 * 유대 각성의 연출 — 누르는 순간의 「충전」, 각성이 확정된 축의 「폭발」, 초기화의 「되돌아오는 하트」.
 *
 * 각성 판은 누를 때마다 같은 제목으로 갈아 끼워지므로(`openBondAwakening`) 연출은 판 안이 아니라 **판보다 한 층
 * 위의 씬 층**에 세우고 월드 좌표로 그린다 — 판이 바뀌어도 날아가던 하트가 끊기지 않는다.
 * 화면 전체의 규칙을 지킨다: 파문은 납작한 마름모, 파편은 위로 뜨는 마름모, 섬광은 옅게, 난수는 쓰지 않는다.
 */
export const BOND_AWAKEN_FX = {
  /** 누르는 순간 — 버튼 둘레가 조여 들고 하트 다섯이 축으로 날아간다. */
  charge: { ring: { from: 90, to: 26, duration: 220 }, hearts: 5, flight: 360, stagger: 34, size: 30, arc: 120 },
  /** 확정된 축 — 섬광 · 빛무리 · 파문 셋 · 파편 열 · 「+2%」. */
  burst: {
    flash: { alpha: 0.26, rise: 110, fall: 360 },
    glow: { size: 300, duration: 520 },
    ripple: { count: 3, from: 40, to: 300, thickness: 6, duration: 620, stagger: 110, squash: 0.62 },
    shard: { count: 10, size: 30, distance: 220, duration: 680, stagger: 22 },
    text: { size: 54, rise: 120, hold: 420, duration: 900 },
    shake: { duration: 180, intensity: 0.005 },
  },
  /** 초기화 — 투자한 칸마다 하트가 떠올라 남은 각성 수로 돌아온다. */
  refund: { hearts: 3, flight: 620, stagger: 70, size: 30, arc: 160, land: { from: 30, to: 170, duration: 520 } },
} as const;

export interface FxPoint { x: number; y: number }

/** 판 안의 좌표를 월드 좌표로 옮긴다. */
export function toWorld(object: Phaser.GameObjects.Container, x: number, y: number): FxPoint {
  const point = object.getWorldTransformMatrix().transformPoint(x, y);
  return { x: point.x, y: point.y };
}

function fxLayer(scene: Phaser.Scene, depth: number, lifeMs: number): Phaser.GameObjects.Container {
  ensureEffectTextures(scene);
  const layer = scene.add.container(0, 0).setDepth(depth);
  scene.time.delayedCall(lifeMs, () => layer.destroy());
  return layer;
}

const reduced = (): boolean => motionPolicy(session.settings).nonEssentialRepeatFactor <= 0;

/** 하트 하나가 `from`에서 위로 휘어 `to`에 닿는다. 닿는 순간 `onLand`. */
function flyHeart(
  scene: Phaser.Scene, layer: Phaser.GameObjects.Container, from: FxPoint, to: FxPoint,
  spec: { size: number; arc: number; flight: number }, index: number, delay: number, color: number, onLand?: () => void,
): void {
  const heart = drawGlyph(scene, "heart", from.x, from.y, spec.size, color, 1, 3).setScale(0.2).setAlpha(0);
  layer.add(heart);
  // 하트마다 휘는 높이와 옆으로 벌어지는 몫을 번호로 정한다 — 같은 각성은 늘 같은 그림이다.
  const lean = (index % 2 === 0 ? -1 : 1) * (18 + (index % 3) * 22);
  const lift = spec.arc * (0.75 + (index % 3) * 0.18);
  const travel = { t: 0 };
  scene.tweens.add({ targets: heart, scale: 1, alpha: 1, duration: 120, delay });
  scene.tweens.add({
    targets: travel, t: 1, duration: spec.flight, delay, ease: "Sine.easeInOut",
    onUpdate: () => {
      const { t } = travel;
      const mx = (from.x + to.x) / 2 + lean, my = Math.min(from.y, to.y) - lift;
      heart.setPosition(
        (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mx + t * t * to.x,
        (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * my + t * t * to.y,
      );
      heart.setAngle(Math.sin(t * Math.PI * 2) * 14);
    },
    onComplete: () => {
      onLand?.();
      scene.tweens.add({ targets: heart, scale: 1.8, alpha: 0, duration: 160, onComplete: () => heart.destroy() });
    },
  });
}

/** 누르는 순간의 충전 — 버튼 둘레가 조여 들고 하트가 그 축으로 날아간다. */
export function playAwakenCharge(scene: Phaser.Scene, depth: number, from: FxPoint, to: FxPoint | undefined, color: number): void {
  const spec = BOND_AWAKEN_FX.charge;
  const layer = fxLayer(scene, depth, spec.flight + spec.stagger * spec.hearts + 400);
  const ring = scene.add.graphics({ x: from.x, y: from.y }).setBlendMode(Phaser.BlendModes.ADD);
  layer.add(ring);
  const spread = { r: spec.ring.from };
  scene.tweens.add({
    targets: spread, r: spec.ring.to, duration: spec.ring.duration, ease: "Cubic.easeIn",
    onUpdate: () => {
      const life = (spread.r - spec.ring.from) / (spec.ring.to - spec.ring.from);
      ring.clear();
      ring.lineStyle(5, color, 0.35 + life * 0.6);
      ring.strokePoints(toPoints(burstDiamond(spread.r, 0.62)), true);
    },
    onComplete: () => ring.destroy(),
  });
  if (!to || reduced()) return;
  for (let index = 0; index < spec.hearts; index += 1) {
    flyHeart(scene, layer, from, to, spec, index, 80 + index * spec.stagger, index % 2 === 0 ? color : 0xffe0ea);
  }
}

/** 각성이 확정된 축에서 한 번 크게 터진다. */
export function playAwakenBurst(scene: Phaser.Scene, depth: number, at: FxPoint, label: string, color: number): void {
  const { flash, glow, ripple, shard, text, shake } = BOND_AWAKEN_FX.burst;
  const layer = fxLayer(scene, depth, text.duration + text.hold + 200);
  const camera = scene.cameras.main;

  const wash = scene.add.rectangle(camera.width / 2, camera.height / 2, camera.width, camera.height, color, 0).setBlendMode(Phaser.BlendModes.ADD);
  layer.add(wash);
  scene.tweens.add({ targets: wash, alpha: flash.alpha, duration: flash.rise, yoyo: true, hold: 30, onComplete: () => wash.destroy() });

  const bloom = scene.add.image(at.x, at.y, EFFECT_TEXTURE.glow).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(glow.size * 0.3, glow.size * 0.3);
  layer.add(bloom);
  scene.tweens.add({ targets: bloom, displayWidth: glow.size, displayHeight: glow.size, alpha: 0, duration: glow.duration, ease: "Cubic.easeOut", onComplete: () => bloom.destroy() });

  // 가운데 섬광 — 흰 마름모가 한 번 부풀었다 사라진다.
  const core = scene.add.graphics({ x: at.x, y: at.y }).setBlendMode(Phaser.BlendModes.ADD);
  core.fillStyle(0xffffff, 0.95);
  core.fillPoints(toPoints(burstDiamond(26, 1)), true);
  core.setScale(0.3);
  layer.add(core);
  scene.tweens.add({ targets: core, scale: 1.6, alpha: 0, angle: 45, duration: 420, ease: "Cubic.easeOut", onComplete: () => core.destroy() });

  for (let index = 0; index < ripple.count; index += 1) {
    const ring = scene.add.graphics({ x: at.x, y: at.y });
    layer.add(ring);
    const spread = { r: ripple.from };
    scene.tweens.add({
      targets: spread, r: ripple.to, duration: ripple.duration, delay: index * ripple.stagger, ease: "Cubic.easeOut",
      onUpdate: () => {
        const life = (spread.r - ripple.from) / (ripple.to - ripple.from);
        ring.clear();
        ring.lineStyle(ripple.thickness * (1 - life * 0.6), index === 1 ? 0xffffff : color, 0.9 * (1 - life));
        ring.strokePoints(toPoints(burstDiamond(spread.r, ripple.squash)), true);
      },
      onComplete: () => ring.destroy(),
    });
  }

  for (let index = 0; index < shard.count; index += 1) {
    const vector = breakthroughShardVector(index, shard.count);
    const reach = shard.distance * (0.7 + (index % 3) * 0.15);
    const piece = scene.add.image(at.x, at.y, EFFECT_TEXTURE.shard)
      .setTint(index % 3 === 0 ? 0xffffff : color).setDisplaySize(shard.size, shard.size).setBlendMode(Phaser.BlendModes.ADD);
    layer.add(piece);
    scene.tweens.add({
      targets: piece, x: at.x + vector.x * reach, y: at.y + vector.y * reach, alpha: 0, scale: 0.25, angle: vector.x * 140,
      duration: shard.duration, delay: index * shard.stagger, ease: "Cubic.easeOut", onComplete: () => piece.destroy(),
    });
  }

  const gain = scene.add.text(at.x, at.y - 30, label, textStyle({ role: "display", size: text.size, color: "#ffffff" }))
    .setOrigin(0.5).setStroke("#8a1238", 10).setShadow(0, 6, "#05070a", 8, false, true).setScale(0.2);
  layer.add(gain);
  scene.tweens.add({ targets: gain, scale: 1, duration: 260, ease: "Back.easeOut" });
  scene.tweens.add({ targets: gain, y: at.y - 30 - text.rise, duration: text.duration, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: gain, alpha: 0, delay: text.hold, duration: text.duration - text.hold, onComplete: () => gain.destroy() });

  shakeCamera(camera, shake.duration, shake.intensity);
}

/** 판 안의 한 조각을 톡 부풀렸다 되돌린다(각성 레벨 칩 · 남은 수). */
export function popTarget(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, to = 1.25): void {
  // 겹쳐 불러도 배율이 떠내려가지 않게 늘 1에서 시작한다.
  scene.tweens.killTweensOf(target);
  target.setScale(1);
  scene.tweens.add({ targets: target, scale: to, duration: 140, yoyo: true, ease: "Sine.easeOut" });
}

/** 판 안의 줄 하나를 분홍 빛으로 한 번 훑는다. */
export function flashRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, y: number, width: number, height: number, color: number): void {
  const band = scene.add.rectangle(0, y, width, height, color, 0.55).setBlendMode(Phaser.BlendModes.ADD);
  parent.add(band);
  scene.tweens.add({ targets: band, alpha: 0, duration: 560, ease: "Sine.easeIn", onComplete: () => band.destroy() });
  if (reduced()) return;
  const sweep = scene.add.rectangle(-width / 2, y, 90, height, 0xffffff, 0.5).setBlendMode(Phaser.BlendModes.ADD);
  parent.add(sweep);
  scene.tweens.add({ targets: sweep, x: width / 2, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => sweep.destroy() });
}

/** 초기화 — 투자했던 칸마다 하트가 떠올라 남은 각성 수로 돌아오고, 닿을 때마다 그 자리가 반짝인다. */
export function playAwakenRefund(scene: Phaser.Scene, depth: number, froms: readonly FxPoint[], to: FxPoint, color: number, onLand?: (index: number) => void): number {
  const spec = BOND_AWAKEN_FX.refund;
  const total = froms.length * spec.hearts;
  const lastDelay = 120 + Math.max(0, total - 1) * spec.stagger;
  const layer = fxLayer(scene, depth, lastDelay + spec.flight + spec.land.duration + 300);
  let landed = 0;
  const landPulse = (): void => {
    const ring = scene.add.graphics({ x: to.x, y: to.y }).setBlendMode(Phaser.BlendModes.ADD);
    layer.add(ring);
    const spread = { r: spec.land.from };
    scene.tweens.add({
      targets: spread, r: spec.land.to, duration: spec.land.duration, ease: "Cubic.easeOut",
      onUpdate: () => {
        const life = (spread.r - spec.land.from) / (spec.land.to - spec.land.from);
        ring.clear();
        ring.lineStyle(5, color, 0.85 * (1 - life));
        ring.strokePoints(toPoints(burstDiamond(spread.r, 0.62)), true);
      },
      onComplete: () => ring.destroy(),
    });
  };
  if (reduced()) {
    landPulse();
    onLand?.(0);
    return spec.land.duration;
  }
  let n = 0;
  froms.forEach((from) => {
    for (let k = 0; k < spec.hearts; k += 1) {
      const index = n;
      n += 1;
      flyHeart(scene, layer, from, to, spec, index, 120 + index * spec.stagger, index % 2 === 0 ? color : 0xffe0ea, () => {
        onLand?.(landed);
        landed += 1;
        if (landed === total) landPulse();
      });
    }
  });
  return lastDelay + spec.flight;
}
