import Phaser from "phaser";
import { INK_SHAPES, INK_SHAPE_IDS, INK_STYLE, inkTextureKey, type InkPart, type InkPoint, type InkShapeId } from "./inkShapes";

/**
 * 전장 이펙트의 잉크 조각을 굽는다 — 도형과 결은 `inkShapes.ts` 한 표가 갖는다.
 *
 * **한 번만 굽고 tint로 색만 갈아 끼운다.** 캔버스 텍스처는 전역 TextureManager가 가지므로 씬이
 * 바뀌어도 살아남는다. 잉크선은 검게, 흰 면은 tint 색으로, 그늘은 그 색의 어두운 톤으로 선다.
 */

function tracePolygon(context: CanvasRenderingContext2D, points: readonly InkPoint[]): void {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function paintPart(context: CanvasRenderingContext2D, part: InkPart): void {
  tracePolygon(context, part.points);
  context.fillStyle = part.fill === "shade" ? INK_STYLE.shade : INK_STYLE.white;
  context.fill();
  if (part.shade) {
    context.save();
    tracePolygon(context, part.points);
    context.clip();
    tracePolygon(context, part.shade);
    context.fillStyle = INK_STYLE.shade;
    context.fill();
    context.restore();
  }
  if (part.lineWidth > 0) {
    tracePolygon(context, part.points);
    context.lineWidth = part.lineWidth;
    context.strokeStyle = INK_STYLE.ink;
    context.stroke();
  }
}

function bakeInkShape(scene: Phaser.Scene, id: InkShapeId): void {
  const shape = INK_SHAPES[id];
  const scale = INK_STYLE.bakeScale;
  const canvas = scene.textures.createCanvas(inkTextureKey(id), shape.width * scale, shape.height * scale);
  const context = canvas?.getContext();
  if (!canvas || !context) return;
  context.save();
  context.scale(scale, scale);
  context.translate(shape.width / 2, shape.height / 2);
  context.lineJoin = "miter";
  context.lineCap = "butt";
  context.miterLimit = INK_STYLE.miterLimit;
  shape.parts.forEach((part) => paintPart(context, part));
  context.restore();
  canvas.refresh();
}

/** 잉크 조각을 준비한다. 이미 구워진 것은 건너뛰므로 씬마다 불러도 된다. */
export function ensureInkTextures(scene: Phaser.Scene): void {
  for (const id of INK_SHAPE_IDS) {
    if (!scene.textures.exists(inkTextureKey(id))) bakeInkShape(scene, id);
  }
}
