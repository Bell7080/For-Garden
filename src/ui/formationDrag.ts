import Phaser from "phaser";
import { COLOR, textStyle } from "./theme";

/** 슬롯 드래그가 탭이나 손떨림보다 먼저 시작되지 않게 하는 공용 모바일 계약이다. */
export const FORMATION_HOLD_MS = 360;
const MOVE_SLOP = 12;

export interface FormationDragSlot {
  hit: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 상단 SD 슬롯에만 붙는 탭/길게 누르기/드래그 상태기다.
 * Puppet은 컨테이너 좌표를 상속하지 않으므로 원본 대신 확대된 번호 고스트만 화면 좌표로 움직인다.
 */
export function bindFormationDrag(
  scene: Phaser.Scene,
  slots: readonly FormationDragSlot[],
  options: { enabled?: () => boolean; canDrag?: () => boolean; onTap: (slot: number) => void; onDrop: (from: number, to: number) => void },
): void {
  slots.forEach((source, from) => {
    let pointerId: number | undefined;
    let startX = 0;
    let startY = 0;
    let armed = false;
    let dragging = false;
    let timer: Phaser.Time.TimerEvent | undefined;
    let ghost: Phaser.GameObjects.Container | undefined;
    let highlights: Phaser.GameObjects.Rectangle[] = [];

    const reset = (): void => {
      timer?.remove(); timer = undefined;
      ghost?.destroy(true); ghost = undefined;
      highlights.forEach((item) => item.destroy()); highlights = [];
      source.hit.setScale(1); pointerId = undefined; armed = false; dragging = false;
    };
    const beginDrag = (pointer: Phaser.Input.Pointer): void => {
      dragging = true;
      // 도착 가능 칸은 accent의 얇은 면만 깔아 기존 홀로그램 테마의 외곽 판을 만들지 않는다.
      highlights = slots.map((slot, index) => scene.add.rectangle(slot.x, slot.y, slot.width - 8, slot.height - 8, COLOR.accent, index === from ? 0 : 0.14).setDepth(4998));
      ghost = scene.add.container(pointer.worldX, pointer.worldY).setDepth(4999).setScale(1.16);
      ghost.add(scene.add.circle(0, 0, 44, COLOR.panel, 0.9).setStrokeStyle(2, COLOR.accent, 0.9));
      ghost.add(scene.add.text(0, 0, `${from + 1}`, textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0.5));
    };
    const finish = (pointer: Phaser.Input.Pointer): void => {
      if (pointerId !== pointer.id) return;
      timer?.remove(); timer = undefined;
      const target = slots.findIndex((slot) => Math.abs(pointer.worldX - slot.x) <= slot.width / 2 && Math.abs(pointer.worldY - slot.y) <= slot.height / 2);
      const wasDragging = dragging;
      const wasArmed = armed;
      reset();
      // 짧은 탭만 해제하고, 긴 누름 무이동은 아무 변화 없이, 이동 드롭만 순서를 바꾼다.
      if (wasDragging) { if (target >= 0 && target !== from) options.onDrop(from, target); }
      else if (!wasArmed) options.onTap(from);
    };

    source.hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointerId !== undefined || options.enabled?.() === false) return;
      pointerId = pointer.id; startX = pointer.worldX; startY = pointer.worldY;
      source.hit.setScale(1.06);
      timer = scene.time.delayedCall(FORMATION_HOLD_MS, () => { armed = true; });
    });
    const move = (pointer: Phaser.Input.Pointer): void => {
      if (pointerId !== pointer.id || !pointer.isDown) return;
      const moved = Math.hypot(pointer.worldX - startX, pointer.worldY - startY) >= MOVE_SLOP;
      if (armed && moved && !dragging && options.canDrag?.() !== false) beginDrag(pointer);
      if (dragging) ghost?.setPosition(pointer.worldX, pointer.worldY);
    };
    // 이동 중 포인터가 출발 면을 벗어나도 도착 슬롯까지 계속 추적한다.
    scene.input.on("pointermove", move);
    scene.input.on("pointerup", finish);
    scene.input.on("pointerupoutside", finish);
    source.hit.once("destroy", () => {
      reset();
      scene.input.off("pointermove", move);
      scene.input.off("pointerup", finish);
      scene.input.off("pointerupoutside", finish);
    });
  });
}
