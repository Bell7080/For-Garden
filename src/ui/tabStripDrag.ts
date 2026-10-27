import Phaser from "phaser";

/** 탭을 누른 손과 줄을 끄는 손을 가르는 거리(화면 픽셀). */
export const TAB_STRIP_DRAG_SLOP = 14;

export interface TabStripDragOptions {
  /** 흐르는 줄(탭을 담은 컨테이너). 손이 잡으면 흘러가던 넘김을 멈춘다. */
  row: Phaser.GameObjects.Container;
  /** 줄 영역을 재는 좌표계. 없으면 화면 좌표다. 손이 이 좌표의 영역 안에서 시작해야 줄을 잡는다. */
  frame?: Phaser.GameObjects.Container;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** 줄이 밀릴 수 있는 끝(음수)과 0 사이. 다 보이면 끌지 않는다. */
  min: number;
  /** 지금 스크롤을 읽고 쓴다. */
  get: () => number;
  set: (value: number) => void;
}

/**
 * 옆으로 흐르는 탭 줄을 손으로 끌어 넘긴다 — 프리미엄 상점·업적 창이 함께 쓴다(패스 창은 제 줄이 같은 규칙을 갖는다).
 *
 * 탭을 눌러 그 칸이 가운데로 모이는 넘김은 그대로 두고, 그 위에 끄는 손을 얹는다. 탭 위에서 시작한 손도 잡아야
 * 하므로 입력 면을 따로 깔지 않고 씬의 포인터를 듣는다. 끌다 놓은 손은 탭을 고르지 않도록 `dragging()`이 한 박자
 * 동안 참을 낸다 — 탭의 고르기가 놓는 순간에 불리기 때문이다.
 */
export function attachTabStripDrag(scene: Phaser.Scene, options: TabStripDragOptions): { dragging: () => boolean } {
  let press: { x: number; scroll: number } | undefined;
  let moved = false;
  const owner = options.frame ?? options.row;
  const local = (pointer: Phaser.Input.Pointer): { x: number; y: number } => options.frame ? options.frame.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y) : { x: pointer.x, y: pointer.y };
  const scaleX = (): number => (options.frame ? options.frame.getWorldTransformMatrix().scaleX : 1) || 1;
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    moved = false;
    if (!owner.active || !owner.visible || options.min >= 0) { press = undefined; return; }
    const point = local(pointer);
    const inside = point.x >= options.left && point.x <= options.right && point.y >= options.top && point.y <= options.bottom;
    press = inside ? { x: pointer.x, scroll: options.get() } : undefined;
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!press || !pointer.isDown || !owner.active) return;
    const dx = (pointer.x - press.x) / scaleX();
    if (!moved && Math.abs(pointer.x - press.x) < TAB_STRIP_DRAG_SLOP) return;
    if (!moved) scene.tweens.killTweensOf(options.row);
    moved = true;
    options.set(Phaser.Math.Clamp(press.scroll + dx, options.min, 0));
  };
  const onUp = (): void => { press = undefined; scene.time.delayedCall(0, () => { moved = false; }); };
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  const detach = (): void => {
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
  };
  options.row.once(Phaser.GameObjects.Events.DESTROY, detach);
  return { dragging: () => moved };
}
