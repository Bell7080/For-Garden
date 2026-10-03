import Phaser from "phaser";
import { pointInClip, type ClipRect } from "./clipRect";

/**
 * 스크롤 창 안에서만 손을 받는 투명 입력면.
 *
 * 기하 마스크는 그리기만 자르고 입력은 자르지 않는다. 창 밖으로 밀려 내려간 카드의 입력면이 그대로 남으면, 그
 * 아래에 선 하단 탭·버튼이 Phaser의 "맨 위 하나만 받는다" 규칙에 막혀 눌리지 않는다(프리미엄 패키지 탭에서
 * 로비를 눌러도 뒤의 패키지만 눌리던 버그). 창 밖 좌표에서는 입력면이 **없는 것으로 판정**되어 손이 그대로 아래로 내려간다.
 * `clip`은 월드 좌표 창이고 매번 읽으므로 호출 쪽이 값을 바꿔도 따라온다.
 */
export function addClippedHit(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number, y: number, width: number, height: number,
  clip: () => ClipRect,
  options: { useHandCursor?: boolean } = {},
): Phaser.GameObjects.Rectangle {
  const hit = scene.add.rectangle(x, y, width, height, 0xffffff, 0);
  hit.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
    hitAreaCallback: (area: Phaser.Geom.Rectangle, localX: number, localY: number, object: Phaser.GameObjects.GameObject): boolean => {
      if (!Phaser.Geom.Rectangle.Contains(area, localX, localY)) return false;
      const point = (object as Phaser.GameObjects.Rectangle).getWorldTransformMatrix().transformPoint(localX - width / 2, localY - height / 2);
      return pointInClip(clip(), point.x, point.y);
    },
    useHandCursor: options.useHandCursor ?? true,
  });
  parent.add(hit);
  return hit;
}
