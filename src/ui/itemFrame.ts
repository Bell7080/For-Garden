import Phaser from "phaser";
import { chipPoints, drawInnerVignette, drawShapeOutline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 그림 한 장을 담는 액자 한 칸 — **재화·아이템이 서는 모든 자리의 유일한 양식.**
 *
 * 화면의 **액자 예외**를 쓰는 자리가 하나둘이 아니었다: 가방 칸, 임무·우편 보상, 발굴 현황,
 * 수확 영수증, 구매 확인, 스테미나 충전, 재화 안내, 원정 전리품, 교류 보상. 저마다 액자 색과
 * 그림 비율, 수량 자리를 따로 정해 두어 **같은 골드가 화면마다 다른 크기와 다른 진하기로**
 * 보였다. 값은 여기 한 표에만 두고, 새 자리는 `addFramedIcon` 한 장을 그대로 쓴다.
 *
 * 기준은 이미 잘 읽히던 **발굴 현황·임무·우편 보상 액자**다 — 불투명한 남색 면에 사방 외곽선을
 * 두르고 안쪽만 깊게 눌러, 배경 원화 위에서도 어디까지가 그림인지 또렷하다. 룬만 등급 색과
 * 주 옵션 뒷배경까지 함께 그려야 해서 `addRuneFrame`이 따로 있다.
 */
export const ITEM_FRAME = {
  /** 액자 안에서 그림이 차지하는 비율. */
  icon: 0.78,
  /** 왼쪽 위·오른쪽 아래만 깎는 길이(액자 한 변 대비). */
  bevel: 0.22,
  fill: 0x101722,
  fillAlpha: 0.98,
  outlineAlpha: 0.82,
  outlineWidth: 3,
  vignette: 0.62,
  /**
   * 그림 뒤에 깔리는 검은 복제본.
   *
   * 어두운 판 위에서는 보이지 않지만, 발굴 카드처럼 **밝은 원화 위**에 서는 액자에서는 이
   * 한 겹이 없으면 노란 재화가 노란 옷에 묻힌다. 판을 받치지 않는 이유는 액자 안에 상자가
   * 하나 더 생기기 때문이다.
   */
  shadow: { offsetX: 4, offsetY: 5, alpha: 0.5 },
  /** 우하단 수량 글자가 액자 한 변에서 차지하는 비율. */
  amountRatio: 0.23,
} as const;

export interface ItemFrameOptions {
  /** 액자 안 그림이 액자 한 변에서 차지하는 비율. 비우면 공용 값이다. */
  iconRatio?: number;
  /** 사방 외곽선 색. 비우면 강조색이다. */
  color?: number;
  /** 외곽선 진하기·굵기. 수령 가능처럼 상태를 알려야 하는 자리만 넘긴다. */
  outlineAlpha?: number;
  outlineWidth?: number;
  /** 면 색과 진하기. 완료처럼 눌러 두어야 하는 자리만 넘긴다. */
  fill?: number;
  fillAlpha?: number;
}

/** 액자만 그린다. 안에 담을 그림은 부르는 쪽이 같은 자리에 얹는다. */
export function addItemFrame(scene: Phaser.Scene, x: number, y: number, size: number, options: ItemFrameOptions = {}): Phaser.GameObjects.Container {
  const frame = scene.add.container(x, y);
  const shape = chipPoints(size, size, { bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 } });
  frame.add(drawLayer(scene, 0, 0, shape, { fill: options.fill ?? ITEM_FRAME.fill, alpha: options.fillAlpha ?? ITEM_FRAME.fillAlpha }));
  frame.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
  frame.add(drawShapeOutline(scene, 0, 0, shape, {
    color: options.color ?? COLOR.accent,
    alpha: options.outlineAlpha ?? ITEM_FRAME.outlineAlpha,
    width: options.outlineWidth ?? ITEM_FRAME.outlineWidth,
  }));
  return frame;
}

export interface FramedIconOptions extends ItemFrameOptions {
  /** 액자 우하단에 겹칠 수. 비우면 수를 적지 않는다. */
  amount?: string;
  /** 수 글자 색. 비우면 강조색이다. */
  amountColor?: string;
  /** 그림 자체의 진하기. 이미 받은 보상처럼 눌러 두어야 하는 자리만 넘긴다. */
  iconAlpha?: number;
}

/**
 * 액자 + 그림 + (있으면) 수량까지 한 번에 세우는 공용 프리팹.
 *
 * **재화나 아이템 그림이 서는 자리는 어디서나 이 한 장을 쓴다.** 수량은 액자 **우하단**에
 * 겹치고 검은 획으로 액자 선에서 떼어 놓는다 — 그림과 수가 두 정보로 갈라지지 않게 하려는
 * 것이라, 자리를 화면마다 옮기면 그 뜻이 사라진다.
 */
export function addFramedIcon(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  size: number,
  textureKey: string,
  options: FramedIconOptions = {},
): Phaser.GameObjects.Container {
  const holder = scene.add.container(x, y);
  const shape = chipPoints(size, size, { bevel: { topLeft: size * ITEM_FRAME.bevel, topRight: 0, bottomRight: size * ITEM_FRAME.bevel, bottomLeft: 0 } });
  holder.add(drawLayer(scene, 0, 0, shape, { fill: options.fill ?? ITEM_FRAME.fill, alpha: options.fillAlpha ?? ITEM_FRAME.fillAlpha }));
  if (textureKey && scene.textures.exists(textureKey)) {
    const icon = size * (options.iconRatio ?? ITEM_FRAME.icon);
    const { offsetX, offsetY, alpha } = ITEM_FRAME.shadow;
    holder.add(scene.add.image(offsetX, offsetY, textureKey).setDisplaySize(icon, icon).setTint(0x000000).setAlpha(alpha * (options.iconAlpha ?? 1)));
    holder.add(scene.add.image(0, 0, textureKey).setDisplaySize(icon, icon).setAlpha(options.iconAlpha ?? 1));
  }
  // 비네트와 외곽선은 그림 위에 덮여야 가장자리를 눌러 준다.
  holder.add(drawInnerVignette(scene, 0, 0, shape, { strength: ITEM_FRAME.vignette }));
  holder.add(drawShapeOutline(scene, 0, 0, shape, {
    color: options.color ?? COLOR.accent,
    alpha: options.outlineAlpha ?? ITEM_FRAME.outlineAlpha,
    width: options.outlineWidth ?? ITEM_FRAME.outlineWidth,
  }));
  if (options.amount !== undefined) {
    holder.add(scene.add
      .text(size / 2 - 8, size / 2 - 6, options.amount, textStyle({ role: "display", size: Math.max(18, Math.round(size * ITEM_FRAME.amountRatio)), color: options.amountColor ?? COLOR.accentText }))
      .setOrigin(1, 1)
      .setStroke("#000000", 6)
      .setShadow(2, 3, "#000000", 2, false, true));
  }
  if (parent) parent.add(holder);
  return holder;
}
