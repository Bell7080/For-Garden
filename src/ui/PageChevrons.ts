import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { pressIn, pressOut } from "./pressFeedback";

/**
 * 좌우로 넘길 수 있는 화면의 양쪽 끝에 서는 **반투명 꺾쇠 한 쌍**.
 *
 * 쓸어 넘기는 손짓은 화면에 아무 표식이 없으면 그런 조작이 있는 줄도 모른다. 판을 받치지 않은 꺾쇠
 * 하나만 옅게 세워 "옆에 더 있다"를 말하고, 누르면 그 쪽으로 넘어간다 — 쓸어 넘기기를 모르는 손도
 * 같은 일을 할 수 있다. 꺾쇠는 **그림을 가리지 않을 만큼 옅고**, 아래로 민 검은 한 겹이 밝은 원화
 * 위에서도 획을 떼어 낸다. 넘어갈 쪽이 없으면(처음·끝) 그 쪽 꺾쇠는 사라진다.
 *
 * 순수 값은 `PAGE_CHEVRON` 한 표가 갖는다. 화면은 자리와 넘길 함수만 넘긴다.
 */
export const PAGE_CHEVRON = {
  /** 꺾쇠 한 변의 높이(px). 폭은 그 절반이다. */
  height: 76,
  stroke: 7,
  /** 평소의 진하기 — 원화를 가리지 않으면서 "있다"는 읽히는 선. */
  alpha: 0.5,
  /** 누르는 면 — 획보다 넉넉히 받아 엄지가 빗나가지 않게 한다. */
  hit: { width: 96, height: 180 },
  /** 넘길 쪽으로 살짝 밀렸다 돌아오는 숨. 움직임 줄이기에서는 멈춘다. */
  nudge: { distance: 7, duration: 900 },
} as const;

export interface PageChevronPair {
  readonly container: Phaser.GameObjects.Container;
  /** 넘어갈 쪽이 있는지에 따라 꺾쇠를 세우거나 숨긴다. */
  setEdges(hasPrev: boolean, hasNext: boolean): void;
  setVisible(visible: boolean): void;
}

/** 꺾쇠 하나. `direction`이 -1이면 `<`, 1이면 `>`다. */
function addChevron(scene: Phaser.Scene, x: number, y: number, direction: -1 | 1, onClick: () => void): Phaser.GameObjects.Container {
  const { height, stroke, alpha, hit: hitSize, nudge } = PAGE_CHEVRON;
  const holder = scene.add.container(x, y);
  const glyph = scene.add.container(0, 0);
  const w = height * 0.26;
  const h = height / 2;
  const points = [
    new Phaser.Math.Vector2(-w * direction, -h),
    new Phaser.Math.Vector2(w * direction, 0),
    new Phaser.Math.Vector2(-w * direction, h),
  ];
  const ink = scene.add.graphics();
  ink.lineStyle(stroke + 4, 0x000000, 0.55);
  ink.strokePoints(points.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 4)), false);
  ink.lineStyle(stroke, 0xffffff, 1);
  ink.strokePoints(points, false);
  glyph.add(ink);
  glyph.setAlpha(alpha);
  holder.add(glyph);

  const factor = motionPolicy(session.settings).nonEssentialRepeatFactor;
  if (factor > 0) {
    scene.tweens.add({ targets: glyph, x: nudge.distance * direction, duration: nudge.duration, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  }

  const hit = scene.add.rectangle(0, 0, hitSize.width, hitSize.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => { glyph.setAlpha(Math.min(1, alpha + 0.35)); pressIn(holder); });
  hit.on("pointerout", () => { glyph.setAlpha(alpha); pressOut(holder, "normal", { pop: false }); });
  hit.on("pointerup", () => { glyph.setAlpha(alpha); pressOut(holder); onClick(); });
  holder.add(hit);
  return holder;
}

/**
 * 화면 양쪽 끝(`leftX`·`rightX`)의 같은 높이(`y`)에 꺾쇠 한 쌍을 세운다.
 * 돌려받은 `container`를 넘기는 판에 넣고, 넘긴 뒤에는 `setEdges`로 처음·끝을 알린다.
 */
export function addPageChevrons(
  scene: Phaser.Scene,
  spot: { leftX: number; rightX: number; y: number },
  onStep: (step: -1 | 1) => void,
): PageChevronPair {
  const container = scene.add.container(0, 0);
  const prev = addChevron(scene, spot.leftX, spot.y, -1, () => onStep(-1));
  const next = addChevron(scene, spot.rightX, spot.y, 1, () => onStep(1));
  container.add([prev, next]);
  return {
    container,
    setEdges(hasPrev, hasNext) {
      prev.setVisible(hasPrev);
      next.setVisible(hasNext);
    },
    setVisible(visible) {
      container.setVisible(visible);
    },
  };
}
