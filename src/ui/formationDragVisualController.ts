import Phaser from "phaser";
import type { FormationSlotPreview } from "./formationDragVisual";
import { FORMATION_DRAG_VISUAL, formationDragPreview, formationZoneStyle } from "./formationDragVisual";
import { chipPoints } from "./holo";

/** 컨테이너를 물려받지 않는 Puppet도 쓸 수 있도록 모든 슬롯 좌표는 화면 좌표로 받는다. */
export interface FormationVisualSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 화면별 Puppet 배치기는 공용 컨트롤러가 계산한 표현 명령만 소비한다. */
export interface FormationPreviewFrame {
  preview: FormationSlotPreview[];
  pointer: { x: number; y: number };
  from: number;
  hovered?: number;
}

export interface FormationDragVisualOptions {
  scene: Phaser.Scene;
  slots: readonly FormationVisualSlot[];
  formation: () => readonly (string | undefined | null)[];
  color: number;
  /** 감광 범위도 화면 좌표다. 생략하면 슬롯 전체를 여유 있게 감싼다. */
  dimBounds?: { x: number; y: number; width: number; height: number };
  zoneDepth?: number;
  dimDepth?: number;
  /** 이름표처럼 확정값을 말하는 장식은 드래그 동안 함께 흐리게 한다. */
  labels?: readonly (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha)[];
  renderPreview: (frame: FormationPreviewFrame) => void;
  restore: () => void;
  /** E2E에는 데이터 대신 실제로 보이는 목적지 칸/교체 고스트 여부만 알린다. */
  onVisualState?: (state?: { hovered?: number; replacementVisible: boolean }) => void;
}

export interface FormationDragVisualController {
  beginDrag(from: number, x: number, y: number): void;
  moveDrag(from: number, x: number, y: number): void;
  endDrag(): void;
  destroy(): void;
}

/**
 * 세 편성 화면이 공유하는 Phaser 표현 수명이다.
 * 배열 확정은 맡지 않고 `formationDragPreview`를 통해 `moveFormationSlot`의 결과만 미리 그린다.
 */
export function createFormationDragVisualController(options: FormationDragVisualOptions): FormationDragVisualController {
  const { scene, slots } = options;
  const zones = slots.map((slot) => scene.add.graphics({ x: slot.x, y: slot.y }).setDepth(options.zoneDepth ?? 3).setVisible(false));
  let active: { from: number; dim: Phaser.GameObjects.Rectangle; hovered?: number } | undefined;

  const paintZone = (index: number, hovered: boolean): void => {
    const slot = slots[index];
    const style = formationZoneStyle(hovered);
    const shape = chipPoints(slot.width * style.scale, slot.height * style.scale, {
      bevel: { topLeft: FORMATION_DRAG_VISUAL.zone.bevel, bottomRight: FORMATION_DRAG_VISUAL.zone.bevel },
    });
    const points: Phaser.Geom.Point[] = [];
    for (let point = 0; point < shape.length; point += 2) points.push(new Phaser.Geom.Point(shape[point], shape[point + 1]));
    zones[index].clear().fillStyle(options.color, style.fillAlpha).fillPoints(points, true)
      .lineStyle(style.lineWidth, options.color, style.lineAlpha).strokePoints(points, true);
  };

  const moveDrag = (from: number, x: number, y: number): void => {
    if (!active || active.from !== from) return;
    const hovered = slots.findIndex((slot) => Math.abs(x - slot.x) <= slot.width / 2 && Math.abs(y - slot.y) <= slot.height / 2);
    active.hovered = hovered < 0 ? undefined : hovered;
    zones.forEach((_zone, index) => paintZone(index, index === active?.hovered));
    const picked = options.formation().map((id) => id ?? undefined);
    const preview = formationDragPreview(picked, from, active.hovered, slots.length);
    options.renderPreview({ preview, pointer: { x, y }, from, hovered: active.hovered });
    options.onVisualState?.({ hovered: active.hovered, replacementVisible: preview.some((entry) => entry.moved) });
  };

  const endDrag = (): void => {
    if (!active) return;
    active.dim.destroy(); active = undefined;
    zones.forEach((zone) => zone.clear().setVisible(false));
    options.labels?.forEach((label) => label.setAlpha(1));
    options.restore(); options.onVisualState?.();
  };

  const beginDrag = (from: number, x: number, y: number): void => {
    if (active || options.formation()[from] == null) return;
    const bounds = options.dimBounds ?? (() => {
      const left = Math.min(...slots.map((slot) => slot.x - slot.width / 2));
      const right = Math.max(...slots.map((slot) => slot.x + slot.width / 2));
      const top = Math.min(...slots.map((slot) => slot.y - slot.height / 2));
      const bottom = Math.max(...slots.map((slot) => slot.y + slot.height / 2));
      return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top };
    })();
    const dim = scene.add.rectangle(bounds.x, bounds.y, bounds.width, bounds.height, 0x000000, 0).setDepth(options.dimDepth ?? 2);
    scene.tweens.add({ targets: dim, fillAlpha: FORMATION_DRAG_VISUAL.boardDimAlpha, duration: 120 });
    active = { from, dim };
    zones.forEach((zone) => zone.setVisible(true));
    options.labels?.forEach((label) => label.setAlpha(0.25));
    moveDrag(from, x, y);
  };

  return {
    beginDrag, moveDrag, endDrag,
    destroy: () => { endDrag(); zones.forEach((zone) => zone.destroy()); },
  };
}
