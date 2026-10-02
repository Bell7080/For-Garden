import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { burstDiamond, breakthroughShardVector } from "./breakthroughBurst";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { toPoints } from "./holo";

/**
 * 특성 연구대에서 아이템·재해석을 쓰는 순간의 연출.
 *
 * **넷이 같은 골격이고 색·무게·모양만 다르다.** 모여들고(`gather`) → 터지고(`impact`) → 남은 빛이
 * 위로 뜬다(`afterglow`). 골격이 같아야 "무언가를 룬에 쏟아부었다"가 어떤 조작에서나 같은 말로
 * 읽히고, 다른 것은 그 조작의 성격이다.
 *
 * - `reroll` — 보랏빛. 파편이 **나선으로 돌며** 모여든다. 아직 고르기 전이라 터짐은 가장 가볍다.
 * - `grant` — 미지의 고대 핵. 청록. 사방에서 곧게 모여 한 번 크게 터진다.
 * - `refined` — 정제된 고대 핵. 금빛. 위에서 **빛기둥**이 내리꽂히고 파문이 세 겹이다.
 * - `crystal` — 완전 복원 결정. 얼음빛 흰색. 파편이 가장 많고 섬광이 두 번 친다.
 *
 * 화면 전체의 규칙을 그대로 지킨다: 동그라미 대신 납작한 마름모, 겹쳐 밝아지는 합성은 옅게,
 * 난수 없음(같은 조작이 늘 같은 그림), 흔들림·거리는 움직임 설정을 지난다. 시간은 3배속 전투가
 * 아니므로 느리게 잡되 `impact`까지 0.5초를 넘지 않아 조작이 기다리지 않는다.
 */
export type TraitEffectKind = "reroll" | "grant" | "refined" | "crystal";

interface TraitEffectSpec {
  color: number;
  /** 모여드는 파편 수. */
  gather: number;
  gatherMs: number;
  /** 파문 겹 수. */
  ripples: number;
  /** 터져 나가는 파편 수. */
  shards: number;
  /** 화면 흔들림 세기(0이면 흔들지 않는다). */
  shake: number;
  flash: number;
  /** 나선으로 도는 정도(라디안). 0이면 곧게 모인다. */
  swirl: number;
  beam: boolean;
  doubleFlash: boolean;
}

export const TRAIT_EFFECT: Record<TraitEffectKind, TraitEffectSpec> = {
  reroll: { color: 0xb487ff, gather: 10, gatherMs: 420, ripples: 2, shards: 8, shake: 0.004, flash: 0.28, swirl: 2.4, beam: false, doubleFlash: false },
  grant: { color: 0x7ee8d4, gather: 12, gatherMs: 360, ripples: 2, shards: 10, shake: 0.006, flash: 0.36, swirl: 0, beam: false, doubleFlash: false },
  refined: { color: 0xffc857, gather: 14, gatherMs: 380, ripples: 3, shards: 12, shake: 0.008, flash: 0.42, swirl: 0.8, beam: true, doubleFlash: false },
  crystal: { color: 0x9fe6ff, gather: 16, gatherMs: 400, ripples: 3, shards: 16, shake: 0.01, flash: 0.46, swirl: 0, beam: true, doubleFlash: true },
};

/** 모여드는 파편이 출발하는 둘레. 룬 칸(260)보다 넉넉히 바깥이다. */
const GATHER_RADIUS = 340;

/** 모여드는 파편 하나의 출발점. 같은 인덱스는 늘 같은 자리다. */
export function traitGatherOrigin(index: number, count: number, swirl: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / Math.max(1, count) - Math.PI / 2 + swirl * 0.25;
  return { x: Math.cos(angle) * GATHER_RADIUS, y: Math.sin(angle) * GATHER_RADIUS * 0.62 };
}

/**
 * 한 번 터뜨린다. `onImpact`는 터지는 프레임에 한 번 불린다 — 화면은 그때 판을 다시 그리거나
 * 결과 쪽지를 연다(연출이 끝나길 기다리지 않는다).
 */
export function playTraitEffect(
  scene: Phaser.Scene,
  kind: TraitEffectKind,
  x: number,
  y: number,
  depth: number,
  onImpact: () => void,
  tint?: number,
): void {
  ensureEffectTextures(scene);
  const spec = TRAIT_EFFECT[kind];
  const color = tint ?? spec.color;
  const motion = motionPolicy(session.settings);
  const distance = Math.max(0.25, motion.nonEssentialDistanceFactor);
  const layer = scene.add.container(0, 0).setDepth(depth);
  const camera = scene.cameras.main;
  let impacted = false;

  const impact = (): void => {
    if (impacted) return;
    impacted = true;
    onImpact();
    // 섬광 — 옅게, 화면 전체를 한 번 훑는다. 결정은 두 번 친다.
    const wash = scene.add.rectangle(camera.width / 2, camera.height / 2, camera.width, camera.height, color, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    layer.add(wash);
    scene.tweens.add({
      targets: wash, alpha: spec.flash, duration: 110, yoyo: true, repeat: spec.doubleFlash && motion.nonEssentialRepeatFactor > 0 ? 1 : 0,
      ease: "Sine.easeOut", onComplete: () => wash.destroy(),
    });
    // 파문 — 납작한 마름모. 겹마다 조금씩 늦게 퍼진다.
    for (let index = 0; index < spec.ripples; index += 1) {
      const ring = scene.add.graphics({ x, y });
      layer.add(ring);
      const spread = { radius: 60 };
      const reach = (440 + index * 90) * distance;
      scene.tweens.add({
        targets: spread, radius: reach, duration: 560, delay: index * 110, ease: "Cubic.easeOut",
        onUpdate: () => {
          const life = (spread.radius - 60) / (reach - 60);
          ring.clear();
          ring.lineStyle(6 - index, color, 0.9 * (1 - life));
          ring.strokePoints(toPoints(burstDiamond(spread.radius, 0.44)), true);
        },
        onComplete: () => ring.destroy(),
      });
    }
    // 터져 나가는 파편 — 위로 뜬다(중력으로 쏟지 않는다).
    for (let index = 0; index < spec.shards; index += 1) {
      const vector = breakthroughShardVector(index, spec.shards);
      const piece = scene.add.image(x, y, EFFECT_TEXTURE.shard).setTint(color).setDisplaySize(34, 34)
        .setBlendMode(Phaser.BlendModes.ADD);
      layer.add(piece);
      scene.tweens.add({
        targets: piece, x: x + vector.x * 320 * distance, y: y + vector.y * 320 * distance,
        alpha: 0, scale: 0.3, angle: vector.x * 140, duration: 680, delay: index * 22, ease: "Cubic.easeOut",
        onComplete: () => piece.destroy(),
      });
    }
    // 남은 빛 — 룬 위로 천천히 떠오르는 작은 빛 알갱이. 한 자리 수로 끊는다.
    if (motion.nonEssentialRepeatFactor > 0) {
      for (let index = 0; index < 7; index += 1) {
        const mote = scene.add.image(x + (index - 3) * 44, y + 40, EFFECT_TEXTURE.glow).setTint(color)
          .setDisplaySize(46, 46).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        layer.add(mote);
        scene.tweens.add({
          targets: mote, y: y - 150 - (index % 3) * 40, alpha: { from: 0.8, to: 0 }, duration: 900 + index * 60, delay: 120 + index * 50,
          ease: "Sine.easeOut", onStart: () => mote.setAlpha(0.8), onComplete: () => mote.destroy(),
        });
      }
    }
    if (spec.shake > 0) camera.shake(240, spec.shake * motion.cameraShakeFactor);
    scene.time.delayedCall(1700, () => layer.destroy());
  };

  // 빛기둥 — 위에서 내리꽂힌다. 모여드는 동안 내려와 터지는 순간 사라진다.
  if (spec.beam) {
    const beam = scene.add.rectangle(x, y - 260, 70, 520, color, 0).setBlendMode(Phaser.BlendModes.ADD);
    layer.add(beam);
    scene.tweens.add({ targets: beam, alpha: 0.5, scaleX: { from: 0.2, to: 1 }, duration: spec.gatherMs, ease: "Cubic.easeIn",
      onComplete: () => scene.tweens.add({ targets: beam, alpha: 0, scaleX: 2, duration: 260, onComplete: () => beam.destroy() }) });
  }

  // 모여드는 파편 — 나선으로 도는 정도는 종류가 정한다. 마지막 파편이 닿는 순간이 곧 터지는 순간이다.
  for (let index = 0; index < spec.gather; index += 1) {
    const from = traitGatherOrigin(index, spec.gather, spec.swirl);
    const piece = scene.add.image(x + from.x * distance, y + from.y * distance, EFFECT_TEXTURE.shard).setTint(color)
      .setDisplaySize(30, 30).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD);
    layer.add(piece);
    const progress = { t: 0 };
    scene.tweens.add({
      targets: progress, t: 1, duration: spec.gatherMs, delay: index * 8, ease: "Cubic.easeIn",
      onUpdate: () => {
        const turn = spec.swirl * (1 - progress.t);
        const px = from.x * (1 - progress.t) * distance;
        const py = from.y * (1 - progress.t) * distance;
        piece.setPosition(x + px * Math.cos(turn) - py * Math.sin(turn), y + px * Math.sin(turn) + py * Math.cos(turn));
        piece.setAngle(progress.t * 220).setScale(1 - progress.t * 0.55);
      },
      onComplete: () => { piece.destroy(); if (index === spec.gather - 1) impact(); },
    });
  }
  // 파편이 모두 사라지는 경우를 대비한 안전장치다 — 터짐이 반드시 한 번은 온다.
  scene.time.delayedCall(spec.gatherMs + spec.gather * 8 + 600, impact);
}
