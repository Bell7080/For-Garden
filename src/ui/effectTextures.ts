import Phaser from "phaser";

/**
 * 이펙트가 쓰는 그림 조각.
 *
 * **한 번만 굽고 계속 다시 쓴다.** 파티클마다 도형을 새로 그리거나 캔버스 그림자(`shadowBlur`)로
 * 빛 번짐을 만들면 조각 수만큼 CPU가 도형을 다시 계산해 난전에서 곧바로 프레임이 떨어진다.
 * 흰 그림 한 장을 구워 두고 `tint`로 색만 갈아 끼우면 같은 배치에 묶여 한 번에 그려진다.
 */
export const EFFECT_TEXTURE = {
  /** 튀는 파편 한 조각. 동그라미가 아니라 **위아래로 긴 마름모**다. */
  shard: "fx-shard",
  /** 가운데가 진하고 가장자리로 사라지는 흰 원. 섬광·폭주 발광이 함께 쓴다. */
  glow: "fx-glow",
} as const;

/** 파편 텍스처 한 변의 크기. 배율로 줄여 쓰므로 실제 화면 크기보다 넉넉하게 굽는다. */
const SHARD_SIZE = 64;
const GLOW_SIZE = 256;

/**
 * 마름모 파편.
 *
 * 좌우 꼭짓점의 높이를 어긋나게 둔다 — 정확한 마름모는 반듯한 보석처럼 보이고, 어긋나면
 * 깨져 나온 조각처럼 읽힌다. 바깥 한 겹을 옅게 깔아 가장자리를 부드럽게 만든다.
 */
function bakeShard(scene: Phaser.Scene): void {
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  const diamond = (scale: number, alpha: number): void => {
    const half = (SHARD_SIZE / 2) * scale;
    const center = SHARD_SIZE / 2;
    graphics.fillStyle(0xffffff, alpha);
    graphics.fillPoints([
      new Phaser.Geom.Point(center, center - half),
      new Phaser.Geom.Point(center + half * 0.46, center - half * 0.12),
      new Phaser.Geom.Point(center, center + half),
      new Phaser.Geom.Point(center - half * 0.46, center + half * 0.16),
    ], true);
  };
  diamond(1, 0.34);
  diamond(0.72, 0.62);
  diamond(0.42, 1);
  graphics.generateTexture(EFFECT_TEXTURE.shard, SHARD_SIZE, SHARD_SIZE);
  graphics.destroy();
}

/** 가운데가 진하고 가장자리로 갈수록 사라지는 흰 원. tint로 색만 갈아 쓴다. */
function bakeGlow(scene: Phaser.Scene): void {
  const canvas = scene.textures.createCanvas(EFFECT_TEXTURE.glow, GLOW_SIZE, GLOW_SIZE);
  const context = canvas?.context;
  if (!canvas || !context) return;
  const half = GLOW_SIZE / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  canvas.refresh();
}

/** 이펙트 그림을 준비한다. 이미 구워져 있으면 아무것도 하지 않으므로 씬마다 불러도 된다. */
export function ensureEffectTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(EFFECT_TEXTURE.shard)) bakeShard(scene);
  if (!scene.textures.exists(EFFECT_TEXTURE.glow)) bakeGlow(scene);
}
