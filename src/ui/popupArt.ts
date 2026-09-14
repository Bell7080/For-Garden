import Phaser from "phaser";
import { chipPoints } from "./holo";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";

/**
 * 팝업 몸판 뒤에 원화를 까는 화면이 공유하는 **실루엣과 마스크**.
 *
 * 몸판은 왼쪽 위·오른쪽 아래가 짧은 변의 14%만큼 깎여 있어, 원화를 네모로 깔면 그 두
 * 모서리에서 그림이 삐져나와 판 뒤에 사각형이 한 장 더 있는 것처럼 보인다. 화면마다 이
 * 도형을 다시 만들면 한쪽만 고쳐져 창마다 다른 실루엣이 되므로 여기 한 곳이 갖는다.
 */
export function popupArtShape(width: number, height: number): number[] {
  const unit = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  return chipPoints(width, height, { bevel: { topLeft: unit, topRight: 0, bottomRight: unit, bottomLeft: 0 } });
}

/**
 * **깎인 실루엣 안쪽만 남기는 마스크.** 판·칸·카드가 모두 이 한 장을 쓴다.
 *
 * 화면의 판은 왼쪽 위·오른쪽 아래가 비스듬히 깎여 있는데, 그 안에 까는 것들(원화·가장자리
 * 누르기·전신 Puppet)은 대개 네모다 — 그대로 두면 깎아 낸 두 모서리에서 그 네모가 다시 삐져
 * 나와 판 뒤에 사각형이 한 장 더 있는 것처럼 보인다. `drawFrameVignette`이 특히 그렇다(그
 * 함수는 네 변의 그라데이션 넉 장이라 도형을 모른다).
 *
 * 기하 마스크는 컨테이너 이동을 물려받지 않으므로 **매 프레임 월드 좌표로 다시 그린다** —
 * 팝업은 열릴 때 살짝 떠오르며 움직이고 목록은 스크롤한다. 그 동안 마스크가 제자리에 남으면
 * 잘린 것만 어긋난다. `owner`가 죽으면 함께 거둔다.
 *
 * 한 마스크를 여러 객체가 함께 쓸 수 있다 — 같은 칸을 채우는 원화와 그 위의 가장자리 누르기는
 * 같은 실루엣이므로 마스크를 나눠 가진다.
 */
export function shapeClipMask(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.GameObject & { getWorldTransformMatrix: () => Phaser.GameObjects.Components.TransformMatrix },
  shape: readonly number[],
  offset: { x: number; y: number } = { x: 0, y: 0 },
): Phaser.Display.Masks.GeometryMask {
  const graphics = scene.make.graphics({});
  const sync = (): void => {
    if (!owner.active || !graphics.active) return;
    const matrix = owner.getWorldTransformMatrix();
    const points: Phaser.Geom.Point[] = [];
    for (let index = 0; index < shape.length; index += 2) {
      const point = matrix.transformPoint(offset.x + shape[index], offset.y + shape[index + 1]);
      points.push(new Phaser.Geom.Point(point.x, point.y));
    }
    graphics.clear().fillStyle(0xffffff, 1).fillPoints(points, true);
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sync);
  sync();
  owner.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sync);
    graphics.destroy();
  });
  return graphics.createGeometryMask();
}

/** 팝업 몸판과 같은 실루엣의 마스크. 위 공용 규칙을 판의 로컬 원점에 그대로 쓴다. */
export function popupBodyShapeMask(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  shape: readonly number[],
): Phaser.Display.Masks.GeometryMask {
  return shapeClipMask(scene, body, shape);
}
