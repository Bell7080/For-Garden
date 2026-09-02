import Phaser from "phaser";
import { chipPoints, drawInnerVignette, drawShapeOutline, drawLayer } from "./holo";
import { COLOR } from "./theme";

/**
 * 그림 한 장을 담는 액자 한 칸.
 *
 * 화면의 **액자 예외**를 쓰는 자리가 가방 칸 하나뿐이 아니라서 한곳으로 모았다 — 불투명하게
 * 채우고 사방을 두른 뒤 안쪽만 얕게 눌러, 배경 위에서 어디까지가 그림인지 알린다. 룬은 등급
 * 색과 주 옵션 뒷배경까지 함께 그려야 해서 `addRuneFrame`이 따로 있고, 그 밖의 그림(재화·
 * 소비품·재료)은 모두 이 한 장을 쓴다.
 */
export const ITEM_FRAME = { icon: 0.6, bevel: 0.2, outlineAlpha: 0.7, vignette: 0.3 } as const;

export interface ItemFrameOptions {
  /** 액자 안 그림이 액자 한 변에서 차지하는 비율. 비우면 공용 값이다. */
  iconRatio?: number;
  /** 사방 외곽선 색. 비우면 강조색이다. */
  color?: number;
}

/** 액자만 그린다. 안에 담을 그림은 부르는 쪽이 같은 자리에 얹는다. */
export function addItemFrame(scene: Phaser.Scene, x: number, y: number, size: number, options: ItemFrameOptions = {}): Phaser.GameObjects.Container {
  const frame = scene.add.container(x, y);
  const shape = chipPoints(size, size, { bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 } });
  frame.add(drawLayer(scene, 0, 0, shape, { fill: 0x24282e, alpha: 1 }));
  frame.add(drawShapeOutline(scene, 0, 0, shape, { color: options.color ?? COLOR.accent, alpha: ITEM_FRAME.outlineAlpha }));
  frame.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette, depth: 0.2 }));
  return frame;
}
