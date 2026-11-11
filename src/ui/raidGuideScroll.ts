import Phaser from "phaser";
import { RAID_GUIDE_POPUP as L } from "./raidLayout";
import { addScrollHint } from "./ScrollHint";

/** 이 거리보다 많이 끈 손은 스크롤이고, 그 손을 뗀 자리의 버튼은 눌리지 않는다. */
const DRAG_SLOP = 14;

/** 흐르는 판의 마스크가 보이는 창 위아래로 넘는 폭. 버튼의 입력 창도 같은 값을 쓴다. */
export const GUIDE_MASK_BLEED = 12;

/**
 * 판 안 스크롤. 마스크는 판이 떠오르는 동안에도 맞도록 매 프레임 판의 월드 자리를 따라가고, 판이 실제로
 * 사라질 때(`DESTROY`) 함께 내려간다 — 닫는 연출 동안에도 판은 그려진다.
 */
export function attachGuideScroll(
  scene: Phaser.Scene, frame: Phaser.GameObjects.Container, track: Phaser.GameObjects.Container, viewHeight: number, maxScroll: number,
  read: () => number, write: (value: number) => void, setDragged: (value: boolean) => void,
): void {
  const width = L.width;
  const maskShape = scene.make.graphics({});
  track.setMask(maskShape.createGeometryMask());
  const rect = (): Phaser.Geom.Rectangle => {
    const matrix = frame.getWorldTransformMatrix();
    // 위로는 한 뼘만 넘긴다 — 더 올리면 흐르는 글이 판 윗변의 제목표 밑으로 파고든다.
    const topLeft = matrix.transformPoint(-width / 2, -GUIDE_MASK_BLEED);
    return new Phaser.Geom.Rectangle(topLeft.x, topLeft.y, width * matrix.scaleX, (viewHeight + GUIDE_MASK_BLEED * 2) * matrix.scaleY);
  };
  const sync = (): void => {
    if (!frame.active) return;
    const r = rect();
    maskShape.clear().fillStyle(0xffffff, 1).fillRect(r.x, r.y, r.width, r.height);
  };
  sync();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  addScrollHint(scene, frame, { x: 0, y: viewHeight / 2, width: L.inner, height: viewHeight, owner: track, read: () => ({ offset: -read(), min: -maxScroll }) });
  const scrollTo = (value: number): void => { const next = Phaser.Math.Clamp(value, 0, maxScroll); write(next); track.setY(-next); };
  let active = false;
  let startY = 0;
  let origin = 0;
  const down = (pointer: Phaser.Input.Pointer): void => {
    active = rect().contains(pointer.x, pointer.y);
    startY = pointer.y; origin = read(); setDragged(false);
  };
  const move = (pointer: Phaser.Input.Pointer): void => {
    if (!active || !pointer.isDown) return;
    if (Math.abs(pointer.y - startY) > DRAG_SLOP) setDragged(true);
    if (pointer.y !== startY) scrollTo(origin - (pointer.y - startY));
  };
  const up = (): void => { active = false; };
  const wheel = (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void => { if (rect().contains(pointer.x, pointer.y)) scrollTo(read() + dy * 0.65); };
  const input = scene.input;
  input.on("pointerdown", down); input.on("pointermove", move); input.on("pointerup", up); input.on("wheel", wheel);
  track.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    input.off("pointerdown", down); input.off("pointermove", move); input.off("pointerup", up); input.off("wheel", wheel);
    track.clearMask();
    maskShape.destroy();
  });
}
