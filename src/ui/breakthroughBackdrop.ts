import Phaser from "phaser";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import {
  BREAK_BACKDROP, backdropMotes, backdropRayAngles, backdropShards, backdropSilhouette,
  limitCracks, limitLineSegments, limitTicks, type BackdropPoint,
} from "./breakthroughBackdropShape";

/**
 * 한계 돌파·공명 확정 창의 뒷배경 — 판 자체가 「한계를 뚫는」 장면이 된다(응태 요청 2026-11-24).
 *
 * 움직이지 않는 것(차오르는 빛·빛줄기·깨진 한계선·조각)은 **판 실루엣으로 잘라 캔버스 한 장에 굽고**, 깨진 자리의
 * 빛무리만 따로 한 장 구워 숨 쉬게 한다. 판 밑에서는 마름모 알갱이가 떠오른다. 움직임 줄이기에서는 숨쉬기·알갱이 없이
 * 그림만 선다. 도형과 수치는 `breakthroughBackdropShape.ts`(Phaser 없음)가 갖는다.
 */
export interface BreakthroughBackdropOptions {
  width: number;
  height: number;
  /** 한계선이 지나는 높이 — 판 가운데 기준 국소 y(등급 표식 줄). */
  limitY: number;
  color: number;
  breathe: boolean;
}

const css = (color: number, alpha: number): string =>
  `rgba(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff},${alpha})`;

function bakeClipped(scene: Phaser.Scene, key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
  const context = canvas?.context;
  if (!canvas || !context) return;
  context.save();
  context.translate(width / 2, height / 2);
  context.beginPath();
  backdropSilhouette(width, height).forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.closePath();
  context.clip();
  draw(context);
  context.restore();
  canvas.refresh();
}

function polyline(context: CanvasRenderingContext2D, points: BackdropPoint[]): void {
  context.beginPath();
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.stroke();
}

function paintStatic(context: CanvasRenderingContext2D, width: number, height: number, limitY: number, color: number): void {
  const { rise, rays, limit } = BREAK_BACKDROP;
  // 판 밑에서 차오르는 빛 — 밀어 올리는 힘이 아래에서 온다.
  const bottom = height / 2;
  const riseTop = bottom - height * rise.reach;
  const riseFill = context.createLinearGradient(0, bottom, 0, riseTop);
  riseFill.addColorStop(0, css(color, rise.alpha));
  riseFill.addColorStop(0.5, css(color, rise.alpha * 0.35));
  riseFill.addColorStop(1, css(color, 0));
  context.fillStyle = riseFill;
  context.fillRect(-width / 2, riseTop, width, bottom - riseTop);

  // 깨진 틈에서 위로 뻗는 빛줄기 — 가늘고 끝으로 갈수록 사라진다.
  const originY = limitY - limit.lift;
  const half = (rays.halfWidthDegrees * Math.PI) / 180;
  backdropRayAngles().forEach((angle, index) => {
    const fill = context.createRadialGradient(0, originY, 0, 0, originY, rays.length);
    const strength = index % 2 === 0 ? rays.alpha : rays.alpha * 0.6;
    fill.addColorStop(0, css(0xffffff, strength * 1.4));
    fill.addColorStop(0.25, css(color, strength));
    fill.addColorStop(1, css(color, 0));
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(0, originY);
    context.lineTo(Math.cos(angle - half) * rays.length, originY + Math.sin(angle - half) * rays.length);
    context.lineTo(Math.cos(angle + half) * rays.length, originY + Math.sin(angle + half) * rays.length);
    context.closePath();
    context.fill();
  });

  // 한계선 — 강조색 띠 위에 흰 선, 판 쪽으로 눈금. 가운데에서 위로 꺾여 부러진다.
  const segments = limitLineSegments(width, limitY);
  context.lineJoin = "miter";
  context.lineCap = "butt";
  for (const points of [segments.left, segments.right]) {
    context.strokeStyle = css(color, limit.alpha * 0.55);
    context.lineWidth = 9;
    polyline(context, points);
    context.strokeStyle = css(0xffffff, limit.alpha);
    context.lineWidth = 3;
    polyline(context, points);
  }
  context.strokeStyle = css(0xffffff, limit.alpha * 0.7);
  context.lineWidth = 2;
  for (const tick of limitTicks(width)) {
    const length = tick.major ? limit.tickHeight * 2 : limit.tickHeight;
    context.beginPath();
    context.moveTo(tick.x, limitY);
    context.lineTo(tick.x, limitY + length);
    context.stroke();
  }
  // 틈에서 갈라진 금.
  context.strokeStyle = css(0xffffff, 0.5);
  context.lineWidth = 2;
  limitCracks(limitY).forEach((crack) => polyline(context, crack));

  // 위로 튄 조각 — 좌우 꼭짓점 높이를 어긋나게 깎은 마름모.
  for (const shard of backdropShards(limitY)) {
    context.save();
    context.translate(shard.x, shard.y);
    context.rotate(shard.angle);
    const s = shard.size;
    context.beginPath();
    context.moveTo(0, -s);
    context.lineTo(s * 0.46, -s * 0.12);
    context.lineTo(0, s);
    context.lineTo(-s * 0.46, s * 0.16);
    context.closePath();
    context.fillStyle = css(color, shard.alpha * 0.8);
    context.fill();
    context.strokeStyle = css(0xffffff, shard.alpha);
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
  }
}

function paintBurst(context: CanvasRenderingContext2D, limitY: number, color: number): void {
  const { burst, limit } = BREAK_BACKDROP;
  const y = limitY - limit.lift;
  context.save();
  context.translate(0, y);
  context.scale(1, burst.squash);
  const fill = context.createRadialGradient(0, 0, 0, 0, 0, burst.radius);
  fill.addColorStop(0, css(0xffffff, burst.alpha * 0.9));
  fill.addColorStop(0.18, css(color, burst.alpha));
  fill.addColorStop(1, css(color, 0));
  context.fillStyle = fill;
  context.fillRect(-burst.radius, -burst.radius, burst.radius * 2, burst.radius * 2);
  context.restore();
}

/** 판 몸판 바로 위(내용보다 아래)에 깔 뒷배경 한 겹을 세운다. 부른 쪽은 받은 컨테이너를 `body`에 가장 먼저 넣는다. */
export function addBreakthroughBackdrop(scene: Phaser.Scene, options: BreakthroughBackdropOptions): Phaser.GameObjects.Container {
  const { width, height, limitY, color, breathe } = options;
  const layer = scene.add.container(0, 0);
  const tag = `${Math.round(width)}x${Math.round(height)}:${Math.round(limitY)}:${color.toString(16)}`;
  const staticKey = `break-backdrop:${tag}`;
  const burstKey = `break-backdrop-burst:${tag}`;
  bakeClipped(scene, staticKey, width, height, (context) => paintStatic(context, width, height, limitY, color));
  bakeClipped(scene, burstKey, width, height, (context) => paintBurst(context, limitY, color));
  const glow = scene.add.image(0, 0, burstKey);
  layer.add([scene.add.image(0, 0, staticKey), glow]);
  if (!breathe) return layer;

  const { pulse } = BREAK_BACKDROP.burst;
  glow.setAlpha(pulse.from);
  scene.tweens.add({ targets: glow, alpha: pulse.to, duration: pulse.duration, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });

  ensureEffectTextures(scene);
  const { motes } = BREAK_BACKDROP;
  for (const mote of backdropMotes(width, height)) {
    const image = scene.add.image(mote.x, mote.fromY, EFFECT_TEXTURE.shard).setTint(color).setAlpha(0)
      .setDisplaySize(mote.size * 0.9, mote.size * 1.6);
    layer.add(image);
    const span = mote.fromY - mote.toY;
    scene.tweens.add({
      targets: image, y: mote.toY, duration: mote.duration, delay: mote.delay, repeat: -1,
      onUpdate: () => image.setAlpha(motes.alpha * Math.sin(Math.PI * Phaser.Math.Clamp((mote.fromY - image.y) / span, 0, 1))),
    });
  }
  layer.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(layer.list));
  return layer;
}
