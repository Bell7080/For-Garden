import Phaser from "phaser";
import { classifyFormationGesture, formationDropSlot, type FormationGestureCancelReason } from "./formationGestureRules";

export interface FormationDragSlot {
  hit: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 컨트롤러는 입력 의도만 알리고 편성 배열·저장·고스트 UI는 호출자가 계속 소유한다. */
export interface FormationGestureCallbacks {
  tap: (slot: number) => void;
  dragStart: (slot: number, x: number, y: number) => void;
  dragMove: (slot: number, x: number, y: number) => void;
  drop: (from: number, to: number) => void;
  cancel: (reason: FormationGestureCancelReason, slot?: number) => void;
}

export interface FormationGestureController {
  /** 팝업처럼 씬보다 수명이 짧은 소유자는 닫힐 때 명시적으로 취소한다. */
  cancel: (reason?: FormationGestureCancelReason) => void;
  destroy: () => void;
}

/**
 * 한 화면의 슬롯을 단일 포인터로 직렬화하는 공용 Phaser 입력 어댑터다.
 * 숫자 1~9로 슬롯을 선택한 뒤 좌우 방향키를 누르면 같은 `drop` 경로를 사용한다.
 */
export function bindFormationDrag(
  scene: Phaser.Scene,
  slots: readonly FormationDragSlot[],
  callbacks: FormationGestureCallbacks,
  options: { enabled?: () => boolean; canDrag?: () => boolean } = {},
): FormationGestureController {
  let pointerId: number | undefined;
  let source: number | undefined;
  let startedAt = 0;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let keyboardSlot = 0;
  let destroyed = false;

  const reset = (): void => { pointerId = undefined; source = undefined; dragging = false; };
  const cancel = (reason: FormationGestureCancelReason = "ownerClosed"): void => {
    if (source !== undefined) callbacks.cancel(reason, source);
    reset();
  };
  const downHandlers = slots.map((_slot, index) => (pointer: Phaser.Input.Pointer): void => {
    if (pointerId !== undefined) { callbacks.cancel("secondPointer", source); reset(); return; }
    if (options.enabled?.() === false) { callbacks.cancel("disabled", index); return; }
    pointerId = pointer.id; source = index; keyboardSlot = index;
    startedAt = scene.time.now; startX = pointer.worldX; startY = pointer.worldY;
  });
  slots.forEach((slot, index) => slot.hit.on("pointerdown", downHandlers[index]));

  const move = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== pointerId || source === undefined || !pointer.isDown) return;
    const kind = classifyFormationGesture({ elapsedMs: scene.time.now - startedAt, startX, startY, x: pointer.worldX, y: pointer.worldY });
    if (!dragging && kind === "drag" && options.canDrag?.() !== false) {
      dragging = true; callbacks.dragStart(source, pointer.worldX, pointer.worldY);
    }
    if (dragging) callbacks.dragMove(source, pointer.worldX, pointer.worldY);
  };
  const up = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== pointerId || source === undefined) return;
    const from = source;
    const target = formationDropSlot(slots, pointer.worldX, pointer.worldY);
    const kind = classifyFormationGesture({ elapsedMs: scene.time.now - startedAt, startX, startY, x: pointer.worldX, y: pointer.worldY });
    const wasDragging = dragging;
    // 저사양 프레임에서 move 없이 up만 도착해도 콜백 순서는 항상 start → move → drop이다.
    if (!wasDragging && kind === "drag" && options.canDrag?.() !== false) {
      callbacks.dragStart(from, pointer.worldX, pointer.worldY);
      callbacks.dragMove(from, pointer.worldX, pointer.worldY);
    }
    reset();
    if (target === undefined) { callbacks.cancel("outside", from); return; }
    if (kind === "drag" && options.canDrag?.() === false) { callbacks.cancel("disabled", from); return; }
    if (wasDragging || kind === "drag") { if (target !== from) callbacks.drop(from, target); else callbacks.cancel("outside", from); }
    else if (kind === "tap") callbacks.tap(from);
    else callbacks.cancel("outside", from);
  };
  const outside = (pointer: Phaser.Input.Pointer): void => { if (pointer.id === pointerId) cancel("outside"); };
  const key = (event: KeyboardEvent): void => {
    if (/^[1-9]$/.test(event.key)) { keyboardSlot = Math.min(slots.length - 1, Number(event.key) - 1); return; }
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!delta || options.enabled?.() === false || options.canDrag?.() === false) return;
    const target = Math.max(0, Math.min(slots.length - 1, keyboardSlot + delta));
    if (target !== keyboardSlot) { callbacks.drop(keyboardSlot, target); keyboardSlot = target; }
  };
  scene.input.on("pointermove", move); scene.input.on("pointerup", up); scene.input.on("pointerupoutside", outside);
  scene.input.keyboard?.on("keydown", key);
  const shutdown = (): void => cancel("sceneShutdown");
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true; cancel("ownerClosed");
    slots.forEach((slot, index) => slot.hit.off("pointerdown", downHandlers[index]));
    scene.input.off("pointermove", move); scene.input.off("pointerup", up); scene.input.off("pointerupoutside", outside);
    scene.input.keyboard?.off("keydown", key); scene.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown);
  };
  // 슬롯 컨테이너가 재렌더되면 전역 입력 리스너도 같은 프레임에 폐기한다.
  slots[0]?.hit.once("destroy", destroy);
  return { cancel, destroy };
}
