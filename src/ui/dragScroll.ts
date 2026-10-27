import Phaser from "phaser";
import { anyPopupOpen } from "./PopupLayer";
import { TAP_DRAG_SLOP } from "../core/tapGuard";

/**
 * **세로 스크롤은 객체가 아니라 씬이 듣는다.** 끌기 면(draggable)을 칸들 뒤로 보내 두면 Phaser가 맨 위
 * 한 개체에만 입력을 주므로, 칸(카드·줄) 위에서 시작한 손은 스크롤이 되지 못하고 손을 뗀 자리에서
 * 칸이 눌렸다 — 룬 가방에서 내리려던 손이 룬을 열었다. 씬 수준에서 누른 자리가 영역 안인지만 보고,
 * 끌기로 넘어가는 거리(`TAP_DRAG_SLOP`)부터 스크롤한다. 같은 거리를 넘긴 손은 `tapSlopGuard`가 칸의
 * 눌림으로 보지 않는다.
 */
export interface DragScrollOptions {
  /** 스크롤을 받는 영역(월드 좌표). 배율·이동 중인 팝업도 맞도록 부를 때마다 잰다. */
  bounds: () => Phaser.Geom.Rectangle;
  /** 한 번에 움직인 세로 거리(게임 좌표). */
  onDelta: (dy: number) => void;
  /** 이 컨테이너 안의 개체가 맨 위에서 손을 받을 때만 시작한다(위에 다른 팝업이 있으면 하지 않는다). */
  root?: Phaser.GameObjects.Container;
  /** 추가 차단. 루트가 없으면 팝업이 떠 있을 때 막는다. */
  isBlocked?: () => boolean;
  wheelFactor?: number;
  /** 끝났을 때(손을 떼거나 영역이 사라질 때) 알린다. 관성 등은 쓰지 않는다. */
  owner: Phaser.GameObjects.GameObject;
}

function within(object: Phaser.GameObjects.GameObject | undefined, root: Phaser.GameObjects.Container): boolean {
  let cursor: Phaser.GameObjects.GameObject | undefined = object;
  while (cursor) {
    if (cursor === root) return true;
    cursor = (cursor as unknown as { parentContainer?: Phaser.GameObjects.Container }).parentContainer ?? undefined;
  }
  return false;
}

export function attachDragScroll(scene: Phaser.Scene, options: DragScrollOptions): void {
  let active = false;
  let engaged = false;
  let lastY = 0;
  const blocked = (pointer: Phaser.Input.Pointer): boolean => {
    if (options.isBlocked?.()) return true;
    const hits = scene.input.hitTestPointer(pointer);
    // 맨 위가 슬라이더처럼 스스로 끌리는 개체이면 그 손은 그 개체의 것이다.
    const first = (scene.input.sortGameObjects(hits.slice(), pointer) as Phaser.GameObjects.GameObject[])[0];
    if (first?.input?.draggable) return true;
    if (options.root) return !within(first, options.root);
    return anyPopupOpen();
  };
  const inside = (pointer: Phaser.Input.Pointer): boolean => options.bounds().contains(pointer.x, pointer.y);
  const down = (pointer: Phaser.Input.Pointer): void => {
    active = false; engaged = false;
    if (!options.owner.active || !inside(pointer) || blocked(pointer)) return;
    active = true; lastY = pointer.y;
  };
  const move = (pointer: Phaser.Input.Pointer): void => {
    if (!active) return;
    if (!pointer.isDown) { active = false; return; }
    if (!engaged) {
      if (pointer.getDistance() <= TAP_DRAG_SLOP) return;
      engaged = true;
      // 한도를 넘는 순간 한꺼번에 튀지 않도록 지금 자리에서 이어 간다.
      lastY = pointer.y;
      return;
    }
    options.onDelta(pointer.y - lastY);
    lastY = pointer.y;
  };
  const up = (): void => { active = false; engaged = false; };
  const wheel = (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void => {
    if (!options.owner.active || !inside(pointer) || blocked(pointer)) return;
    options.onDelta(-dy * (options.wheelFactor ?? 0.65));
  };
  scene.input.on("pointerdown", down);
  scene.input.on("pointermove", move);
  scene.input.on("pointerup", up);
  scene.input.on("pointerupoutside", up);
  scene.input.on("wheel", wheel);
  const off = (): void => {
    scene.input.off("pointerdown", down);
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", up);
    scene.input.off("pointerupoutside", up);
    scene.input.off("wheel", wheel);
  };
  options.owner.once(Phaser.GameObjects.Events.DESTROY, off);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
}
