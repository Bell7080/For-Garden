import Phaser from "phaser";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { toPoints } from "./holo";

/**
 * 한계 돌파가 확정되는 순간의 연출.
 *
 * **한 계정에 몇 번 없는 순간이라 크게 터진다** — 잦은 조작이면 같은 무게로 터뜨리지 않았을
 * 것이다. 그래도 화면 전체의 규칙은 그대로 지킨다:
 *
 * - **동그라미를 쓰지 않는다.** 파문은 원이 아니라 **납작한 마름모**이고, 파편도 마름모다.
 * - **중력으로 쏟지 않는다.** 파편은 발밑으로 떨어지지 않고 **위로** 뜬다 — 올라가는 조작이라
 *   흐르는 방향이 곧 그 뜻이다.
 * - **섬광은 옅게 깐다.** 겹쳐 밝아지는 합성이라 진하게 두면 밝은 배경 원화 위에서 하얗게
 *   뭉개져 정작 봐야 할 등급 표식이 그 속에 묻힌다.
 * - **난수를 쓰지 않는다.** 파편은 부채꼴을 고르게 나눠 날아가므로 같은 돌파가 늘 같은 그림을
 *   그린다(연구 결과의 균열 가지와 같은 규칙이다).
 */
export const BREAKTHROUGH_BURST = {
  /** 화면 전체를 한 번 훑는 섬광. 상한(0.6)보다 낮게 둔다. */
  flash: { alpha: 0.4, rise: 120, fall: 300 },
  /** 표식에서 퍼지는 파문 두 겹. 납작한 마름모라 바닥에 누운 것으로 읽힌다. */
  ripple: { count: 2, from: 70, to: 560, thickness: 5, duration: 560, stagger: 130, alpha: 0.9, squash: 0.44 },
  /** 위로 뜨는 마름모 파편. 한 자리 수로 끊는다. */
  shard: { count: 8, size: 30, distance: 300, duration: 640, stagger: 26, spreadDegrees: 150 },
  /** 큰 한 방만 화면을 흔든다. */
  shake: { duration: 260, intensity: 0.008 },
  /** 새 등급 표식이 부풀었다 제자리로 돌아오는 몫. */
  grade: { pop: 1.55, duration: 440 },
} as const;

/**
 * 파편 하나가 날아가는 방향.
 *
 * 위로 벌어진 부채꼴을 **고르게** 나눈다 — 난수를 쓰면 같은 돌파가 매번 다른 그림을 그려
 * 무엇이 일어났는지보다 어지러움이 먼저 남는다. 화면 좌표는 y가 아래로 자라므로 위로 뜨는
 * 쪽이 음수다.
 */
export function breakthroughShardVector(index: number, count: number): { x: number; y: number } {
  const spread = Phaser.Math.DegToRad(BREAKTHROUGH_BURST.shard.spreadDegrees);
  // 한 조각도 정확히 위로만 가지 않도록 칸의 가운데를 쓴다 — 가장자리를 쓰면 양 끝 둘이 수평이다.
  const step = spread / Math.max(1, count);
  const angle = -Math.PI / 2 - spread / 2 + step * (index + 0.5);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** 납작한 마름모 한 겹의 점들. 파문도 파편도 같은 도형을 쓴다. */
export function burstDiamond(radius: number, squash: number): number[] {
  return [0, -radius * squash, radius, 0, 0, radius * squash, -radius, 0];
}

/**
 * 그 자리에서 돌파 연출을 한 번 터뜨린다.
 *
 * 되돌려 받는 컨테이너는 스스로 끝나면 사라진다 — 부른 쪽이 붙잡아 둘 것이 없다.
 */
export function addBreakthroughBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  depth: number,
): Phaser.GameObjects.Container {
  ensureEffectTextures(scene);
  const { flash, ripple, shard, shake } = BREAKTHROUGH_BURST;
  const layer = scene.add.container(0, 0).setDepth(depth);
  const camera = scene.cameras.main;

  // 화면 전체를 훑는 섬광. 겹쳐 밝아지는 합성이라 옅게 깐다.
  const wash = scene.add
    .rectangle(camera.width / 2, camera.height / 2, camera.width, camera.height, color, 0)
    .setBlendMode(Phaser.BlendModes.ADD);
  layer.add(wash);
  scene.tweens.add({
    targets: wash, alpha: flash.alpha, duration: flash.rise, ease: "Sine.easeOut",
    yoyo: true, hold: 40, repeat: 0,
    onComplete: () => scene.tweens.add({ targets: wash, alpha: 0, duration: flash.fall, onComplete: () => wash.destroy() }),
  });

  for (let index = 0; index < ripple.count; index += 1) {
    const ring = scene.add.graphics({ x, y });
    layer.add(ring);
    const spread = { radius: ripple.from };
    scene.tweens.add({
      targets: spread, radius: ripple.to, duration: ripple.duration, delay: index * ripple.stagger, ease: "Cubic.easeOut",
      onUpdate: () => {
        const life = (spread.radius - ripple.from) / (ripple.to - ripple.from);
        ring.clear();
        ring.lineStyle(ripple.thickness, color, ripple.alpha * (1 - life));
        ring.strokePoints(toPoints(burstDiamond(spread.radius, ripple.squash)), true);
      },
      onComplete: () => ring.destroy(),
    });
  }

  for (let index = 0; index < shard.count; index += 1) {
    const vector = breakthroughShardVector(index, shard.count);
    const piece = scene.add
      .image(x, y, EFFECT_TEXTURE.shard)
      .setTint(color)
      .setDisplaySize(shard.size, shard.size)
      .setBlendMode(Phaser.BlendModes.ADD);
    layer.add(piece);
    scene.tweens.add({
      targets: piece,
      x: x + vector.x * shard.distance,
      y: y + vector.y * shard.distance,
      alpha: 0,
      scale: 0.3,
      angle: vector.x * 120,
      duration: shard.duration,
      delay: index * shard.stagger,
      ease: "Cubic.easeOut",
      onComplete: () => piece.destroy(),
    });
  }

  camera.shake(shake.duration, shake.intensity);
  scene.time.delayedCall(flash.rise + flash.fall + ripple.duration + ripple.stagger * ripple.count, () => layer.destroy());
  return layer;
}
