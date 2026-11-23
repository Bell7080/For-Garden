import Phaser from "phaser";
import { t } from "../i18n";
import type { PopupLayer } from "./PopupLayer";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { STATUS_GLYPHS } from "./statusGlyphShapes";
import { paintStatusGlyph, shadeColor } from "./statusGlyph";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import type { UnitStatusView } from "./unitStatusModel";

/**
 * 머리 위 상태 칩을 누르면 열리는 쪽지.
 *
 * 칩은 작아 "무엇이 걸렸나"까지만 말한다 — 몇 겹이 얼마나 남았고 그게 무슨 뜻인지는 눌러서
 * 읽는다. 줄마다 **머리 위 칩을 그대로 키운 액자**(같은 짙은 면·같은 그림·같은 겹 판)가 서고,
 * 그 밑변을 따라 남은 시간이 같은 막대로 흐른다 — 맨 마름모와 글자만 늘어놓던 때는 쪽지의 줄과
 * 머리 위 칩이 같은 상태라는 것을 색 하나로만 짐작했다.
 */
const NOTE = { width: 640, rowHeight: 100, rowGap: 10, top: 108, bottom: 46, chip: 64, rowWidth: 572 } as const;

/** 머리 위 칩과 같은 깎임 비율(28px에 6px)로 키운 액자 한 장. */
function addStatusChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, view: UnitStatusView): void {
  const size = NOTE.chip;
  const bevel = Math.round(size * 0.22);
  const shape = chipPoints(size, size, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  const chip = scene.add.container(x, y);
  chip.add(drawLayer(scene, 0, 0, shape, { fill: shadeColor(view.color, 0.34), alpha: 0.98, shadow: { x: 3, y: 5 } }));
  chip.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.45 }));
  chip.add(paintStatusGlyph(scene, STATUS_GLYPHS[view.id], size * 0.38, 1.6));
  chip.add(drawShapeOutline(scene, 0, 0, shape, { color: view.color, alpha: 1, width: 3 }));
  if (view.stacks !== undefined && view.stacks > 0) {
    // 겹 수는 머리 위 칩처럼 우상단 모서리에 걸터앉는다.
    const r = 15;
    const cx = size / 2 - 2;
    const cy = -size / 2 + 2;
    chip.add(scene.add.graphics().fillStyle(COLOR.void, 0.95).fillRect(cx - r, cy - r, r * 2, r * 2).lineStyle(2, view.color, 1).strokeRect(cx - r, cy - r, r * 2, r * 2));
    chip.add(scene.add.text(cx, cy + 1, String(view.stacks), textStyle({ role: "display", size: 20, color: "#ffffff" })).setOrigin(0.5).setStroke("#000000", 4));
  }
  parent.add(chip);
}

export function openUnitStatusPopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  name: string,
  views: readonly UnitStatusView[],
  anchor?: { x: number; y: number },
): void {
  if (views.length === 0) return;
  const step = NOTE.rowHeight + NOTE.rowGap;
  const height = NOTE.top + views.length * step - NOTE.rowGap + NOTE.bottom;
  popups.open({ width: NOTE.width, height, title: t("unitStatus.title", { name }), anchor, tilt: -1.2 }, (content) => {
    const top = -height / 2 + NOTE.top;
    const left = -NOTE.rowWidth / 2;
    views.forEach((view, index) => {
      const y = top + index * step + NOTE.rowHeight / 2;
      const row = scene.add.container(0, y);
      row.add(drawLayer(scene, 0, 0, chipPoints(NOTE.rowWidth, NOTE.rowHeight, { bevel: { topLeft: 16, bottomRight: 16 } }), {
        fill: 0x0c1118, alpha: 0.82, shadow: false, edge: view.color, edgeWidth: 2,
      }));
      addStatusChip(scene, row, left + 26 + NOTE.chip / 2, -4, view);
      const textLeft = left + 26 + NOTE.chip + 24;
      const room = NOTE.rowWidth / 2 - textLeft - 22;
      const title = scene.add.text(textLeft, -18, view.name, textStyle({ role: "display", size: 28, color: COLOR.ink })).setOrigin(0, 0.5);
      squeezeTextToWidth(title, room);
      const detail = scene.add.text(textLeft, 18, view.detail, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5);
      squeezeTextToWidth(detail, room);
      row.add([title, detail]);
      // 남은 시간은 머리 위 칩과 같은 막대가 줄 밑변을 따라 말한다. 시간이 없는 상태에는 긋지 않는다.
      if (view.remaining !== undefined && view.total) {
        const ratio = Math.max(0, Math.min(1, view.remaining / view.total));
        const barLeft = textLeft;
        const barWidth = room;
        const barY = NOTE.rowHeight / 2 - 12;
        const bar = scene.add.graphics();
        bar.fillStyle(0x000000, 0.75).fillRect(barLeft - 1, barY - 1, barWidth + 2, 7);
        if (ratio > 0) bar.fillStyle(view.color, 1).fillRect(barLeft, barY, barWidth * ratio, 5);
        row.add(bar);
      }
      content.add(row);
    });
  });
}
