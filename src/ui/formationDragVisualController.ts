import Phaser from "phaser";
import type { FormationSlotPreview } from "./formationDragVisual";
import { FORMATION_DRAG_VISUAL, formationDragPreview, formationLiftPose, formationZoneStyle, type FormationLiftPose } from "./formationDragVisual";
import { chipPoints } from "./holo";
import { settingsManager } from "../managers/SettingsManager";

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
  /** 든 몸의 자세. 화면은 높이에 `scale`을 곱하고 발을 `raise`만큼 올린 뒤 `applyLiftPose`를 부른다. */
  lift: FormationLiftPose;
}

/** 쥔 몸이 공통으로 갖는 표시 — 기울기와 색 테두리. 화면마다 따로 짓지 않는다. */
export function applyLiftPose(creature: Phaser.GameObjects.Image & { setAfterimages?: (steps: readonly { dx: number; dy: number; alpha: number; color?: number }[]) => unknown }, pose: FormationLiftPose, color: number): void {
  creature.setRotation(pose.tilt);
  const { rimPx, rimAlpha } = FORMATION_DRAG_VISUAL.lift;
  creature.setAfterimages?.(Array.from({ length: 8 }, (_unused, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { dx: Math.cos(a) * rimPx, dy: Math.sin(a) * rimPx, alpha: rimAlpha, color };
  }));
}

/** 내려놓은 몸에서 쥔 표시를 걷는다. 복구 경로가 늘 부른다. */
export function clearLiftPose(creature: Phaser.GameObjects.Image & { setAfterimages?: (steps: readonly never[]) => unknown }): void {
  creature.setRotation(0);
  creature.setAfterimages?.([]);
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
  /** 손끝(화면 좌표)에서 바닥 그림자까지의 거리. 화면의 SD 높이 절반쯤이다. */
  shadowOffsetY?: number;
  /** 든 SD의 그림자 깊이. 튜토리얼 막 위로 SD를 띄울 때 그림자도 함께 올린다. */
  liftDepth?: () => number | undefined;
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
  let active: { from: number; dim: Phaser.GameObjects.Rectangle; hovered?: number; startedAt: number; x: number; y: number; lastAt: number; vx: number } | undefined;
  const shadow = scene.add.graphics().setDepth((options.zoneDepth ?? 3) + 0.5).setVisible(false);
  const reduceMotion = (): boolean => settingsManager.get().accessibility.reduceMotion;

  const paintShadow = (x: number, y: number, raise: number): void => {
    const { width, height, alpha } = FORMATION_DRAG_VISUAL.shadow;
    // 높이 들수록 작고 옅게 — 들어 올린 거리가 그림자의 크기로 읽힌다.
    const k = Math.max(0.55, 1 - raise / 260);
    const lifted = options.liftDepth?.();
    shadow.setDepth(lifted !== undefined ? lifted - 1 : (options.zoneDepth ?? 3) + 0.5);
    shadow.clear().setPosition(x, y + (options.shadowOffsetY ?? 120)).setVisible(true);
    for (let layer = 0; layer < 4; layer += 1) {
      const f = 1 - layer * 0.22;
      shadow.fillStyle(0x000000, alpha * k * 0.32).fillEllipse(0, 0, width * k * f, height * k * f);
    }
  };

  const render = (): void => {
    if (!active) return;
    const picked = options.formation().map((id) => id ?? undefined);
    const preview = formationDragPreview(picked, active.from, active.hovered, slots.length);
    const lift = formationLiftPose(scene.time.now - active.startedAt, active.vx, reduceMotion());
    paintShadow(active.x, active.y, lift.raise);
    options.renderPreview({ preview, pointer: { x: active.x, y: active.y }, from: active.from, hovered: active.hovered, lift });
  };
  // 손이 멈춰 있어도 쥔 몸은 숨 쉬듯 흔들리고 속도는 가라앉는다.
  const ticker = (): void => {
    if (!active || !shadow.active) return;
    const now = scene.time.now;
    if (now - active.lastAt > 60) active.vx *= 0.82;
    render();
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, ticker);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, ticker));

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
    const now = scene.time.now;
    const dt = Math.max(1, now - active.lastAt);
    // 끄는 속도는 부드럽게 따라가야 기울기가 프레임마다 튀지 않는다.
    active.vx = active.vx * 0.7 + ((x - active.x) / dt) * 0.3;
    active.x = x; active.y = y; active.lastAt = now;
    render();
    const picked = options.formation().map((id) => id ?? undefined);
    const preview = formationDragPreview(picked, from, active.hovered, slots.length);
    options.onVisualState?.({ hovered: active.hovered, replacementVisible: preview.some((entry) => entry.moved) });
  };

  const endDrag = (): void => {
    if (!active) return;
    active.dim.destroy(); active = undefined;
    shadow.clear().setVisible(false);
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
    active = { from, dim, startedAt: scene.time.now, x, y, lastAt: scene.time.now, vx: 0 };
    zones.forEach((zone) => zone.setVisible(true));
    options.labels?.forEach((label) => label.setAlpha(0.25));
    moveDrag(from, x, y);
  };

  return {
    beginDrag, moveDrag, endDrag,
    destroy: () => { endDrag(); scene.events.off(Phaser.Scenes.Events.UPDATE, ticker); shadow.destroy(); zones.forEach((zone) => zone.destroy()); },
  };
}
