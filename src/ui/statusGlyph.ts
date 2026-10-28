import Phaser from "phaser";
import type { StatusGlyph } from "./statusGlyphShapes";

/**
 * 상태·버프 칩 안의 문양을 그린다 — 머리 위 상태 칩과 프로필 버프 칩이 같은 한 벌을 쓴다.
 *
 * 같은 모양을 검게 두껍게 한 번 깔고(잉크 외곽) 그 위에 흰 그림을 얹어, 어떤 바탕색·배경 원화
 * 위에서도 그림이 떨어져 나온다. `scale`은 단위 좌표(−1~1)에 곱하는 픽셀 반지름이고, 선 굵기는
 * 머리 위 칩(반지름 약 11px)을 기준으로 비례해 커진다.
 */
export function paintStatusGlyph(scene: Phaser.Scene, glyph: StatusGlyph, scale: number, weight = 1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const toPoints = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => new Phaser.Geom.Point(x * scale, y * scale));
  const pass = (color: number, lineWidth: number, outline: number): void => {
    for (const part of glyph) {
      const points = toPoints(part.points);
      if (part.kind === "fill") {
        g.fillStyle(color, 1).fillPoints(points, true);
        if (outline > 0) g.lineStyle(outline, color, 1).strokePoints(points, true, true);
      } else {
        g.lineStyle(lineWidth, color, 1).strokePoints(points, part.closed ?? false, part.closed ?? false);
      }
    }
  };
  pass(0x000000, 5 * weight, 3.2 * weight);
  pass(0xffffff, 2.4 * weight, 0);
  return g;
}

/** 상태 색을 어둡게 누른 칩 바탕. `keep`은 남길 밝기의 비율이다. */
export function shadeColor(color: number, keep: number): number {
  return (Math.round(((color >> 16) & 0xff) * keep) << 16) | (Math.round(((color >> 8) & 0xff) * keep) << 8) | Math.round((color & 0xff) * keep);
}
