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
 * 판과 같은 실루엣의 기하 마스크.
 *
 * 기하 마스크는 컨테이너 이동을 물려받지 않으므로 **매 프레임 월드 좌표로 다시 그린다** —
 * 팝업은 열릴 때 살짝 떠오르며 움직이고, 그 동안 마스크가 제자리에 남으면 원화만 어긋난다.
 */
export function popupBodyShapeMask(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  shape: readonly number[],
): Phaser.Display.Masks.GeometryMask {
  const graphics = scene.make.graphics({});
  const sync = (): void => {
    if (!body.active || !graphics.active) return;
    const matrix = body.getWorldTransformMatrix();
    const points: Phaser.Geom.Point[] = [];
    for (let index = 0; index < shape.length; index += 2) {
      const point = matrix.transformPoint(shape[index], shape[index + 1]);
      points.push(new Phaser.Geom.Point(point.x, point.y));
    }
    graphics.clear().fillStyle(0xffffff, 1).fillPoints(points, true);
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sync);
  sync();
  body.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sync);
    graphics.destroy();
  });
  return graphics.createGeometryMask();
}
