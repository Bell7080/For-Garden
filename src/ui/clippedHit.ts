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
  clipHit(hit, clip, options);
  parent.add(hit);
  return hit;
}

/**
 * 이미 만들어진 사각형 입력면(`PortraitCard.hit`처럼 프리팹이 제 손으로 세운 것)을 창 안에서만 받게 한다.
 * `addClippedHit`와 같은 규칙이며, 입력면을 다시 세우므로 기존 `pointer*` 리스너는 그대로 남는다.
 */
export function clipHit(
  hit: Phaser.GameObjects.Rectangle,
  clip: () => ClipRect,
  options: { useHandCursor?: boolean } = {},
): void {
  hit.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(0, 0, hit.width, hit.height),
    hitAreaCallback: (area: Phaser.Geom.Rectangle, localX: number, localY: number, object: Phaser.GameObjects.GameObject): boolean => {
      if (!Phaser.Geom.Rectangle.Contains(area, localX, localY)) return false;
      const target = object as Phaser.GameObjects.Rectangle;
      const point = target.getWorldTransformMatrix().transformPoint(localX - target.displayOriginX, localY - target.displayOriginY);
      return pointInClip(clip(), point.x, point.y);
    },
    useHandCursor: options.useHandCursor ?? true,
  });
}

/**
 * 컨테이너 안쪽 좌표의 사각형을 월드 창으로 바꾼다. 마스크를 컨테이너 기준으로 정의한 목록(등장 배율이 걸린 팝업 등)이
 * 입력 창도 같은 사각형에서 얻게 한다 — 두 곳이 따로 좌표를 적으면 보이는 창과 손을 받는 창이 갈린다.
 */
export function containerClip(container: Phaser.GameObjects.Container, left: number, top: number, right: number, bottom: number): () => ClipRect {
  return () => {
    const matrix = container.getWorldTransformMatrix();
    const a = matrix.transformPoint(left, top);
    const b = matrix.transformPoint(right, bottom);
    return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
  };
}

/**
 * 이미 입력을 받는 개체의 판정에 "창 안" 조건을 덧붙인다. 입력 모양·끌기·손 모양은 그대로 두고 판정만 좁힌다.
 * 행 컴포넌트(스위치·슬라이더·선택 줄)가 제 입력면을 안에서 세우는 목록에 쓴다 — 컴포넌트마다 `clip`을 넘기지 않고
 * 목록을 다 세운 뒤 `clipInteractiveTree`로 한 번에 건다.
 */
export function clipInteractive(object: Phaser.GameObjects.GameObject, clip: () => ClipRect): void {
  const input = object.input;
  if (!input || !input.hitAreaCallback) return;
  const inner = input.hitAreaCallback;
  const target = object as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.ComputedSize & { displayOriginX?: number; displayOriginY?: number; getWorldTransformMatrix: () => Phaser.GameObjects.Components.TransformMatrix };
  input.hitAreaCallback = (area: unknown, localX: number, localY: number, hitObject: Phaser.GameObjects.GameObject): boolean => {
    if (!inner(area, localX, localY, hitObject)) return false;
    const point = target.getWorldTransformMatrix().transformPoint(localX - (target.displayOriginX ?? 0), localY - (target.displayOriginY ?? 0));
    return pointInClip(clip(), point.x, point.y);
  };
}

/** 컨테이너 아래 입력을 받는 모든 개체에 `clipInteractive`를 건다. 목록을 다시 세운 뒤마다 부른다. */
export function clipInteractiveTree(root: Phaser.GameObjects.Container, clip: () => ClipRect): void {
  for (const child of root.list) {
    clipInteractive(child, clip);
    if (child instanceof Phaser.GameObjects.Container) clipInteractiveTree(child, clip);
  }
}
