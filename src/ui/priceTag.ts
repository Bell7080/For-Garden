import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { findItem, ITEM_ICON_FALLBACK, type ItemIcon, type WalletItemKey } from "../data/items";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawGlyph } from "./glyphs";
import { addFramedIcon, addItemFrame, ITEM_FRAME } from "./itemFrame";
import { COLOR, textStyle } from "./theme";

/**
 * **값과 재화가 서는 자리는 글자가 아니라 액자다.**
 *
 * 구매 확인, 무역 묶음, 교류 교환소는 저마다 `1,200 젬`·`골드 3000`처럼 수와 재화 이름을 글로
 * 적어 두었다 — 같은 젬이 화면마다 다른 순서·다른 크기·다른 색으로 서고, 받는 것은 액자인데
 * 드는 것만 글이라 두 줄이 같은 것을 말하는지 한눈에 읽히지 않았다.
 *
 * 값도 **받는 것과 같은 공용 액자**(`addFramedIcon`)로 세운다. 그래서 재화 이름을 적지 않는다 —
 * 그림이 이미 어느 재화인지 말하고, 수는 액자 우하단의 제 자리에 선다. 모자란 값만 그 수가
 * 붉어져 "왜 못 사는가"를 값 자체가 말한다.
 */
export const PRICE_TAG = {
  /** 줄에 서는 기본 액자 한 변. */
  size: 66,
  /** 총가격처럼 그 판의 답이 되는 자리만 한 뼘 크다. */
  emphasizedSize: 78,
  /** 액자 오른쪽 끝이 줄 오른쪽 변에서 물러나는 여백. */
  rightMargin: 0,
} as const;

export interface PriceTagOptions {
  /** 액자 한 변. 비우면 `PRICE_TAG.size`다. */
  size?: number;
  /** 가진 것이 모자라면 수를 붉게 적는다. */
  short?: boolean;
  /** 그림 진하기. 소진된 카드처럼 눌러 두어야 하는 자리만 넘긴다. */
  iconAlpha?: number;
  /** 외곽선 색. 비우면 강조색이다. */
  color?: number;
  /** 수 앞에 붙는 기호(`×`처럼). */
  prefix?: string;
}

/** 값 한 덩어리(재화 그림 + 수)를 공용 액자로 세운다. */
export function addPriceTag(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  currency: WalletItemKey,
  amount: number,
  options: PriceTagOptions = {},
): Phaser.GameObjects.Container {
  const size = options.size ?? PRICE_TAG.size;
  return addFramedIcon(scene, parent, x, y, size, CURRENCY_ICON_BY_WALLET[currency], {
    amount: `${options.prefix ?? ""}${formatCurrency(amount)}`,
    // 값이 모자란 것은 상태 문구보다 값 자체가 먼저 말해야 한다.
    amountColor: options.short ? COLOR.dangerText : COLOR.accentText,
    iconAlpha: options.iconAlpha,
    color: options.color,
  });
}

/** 줄 오른쪽 변에 액자를 붙일 때의 중심 x. 화면마다 반폭을 손으로 빼지 않는다. */
export function priceTagRightCenter(rightEdge: number, size: number = PRICE_TAG.size): number {
  return rightEdge - PRICE_TAG.rightMargin - size / 2;
}

/** 액자 한 변에서 수 글자가 차지하는 비율. 값 줄의 높이를 가늠하는 자리가 함께 읽는다. */
export const PRICE_TAG_AMOUNT_RATIO = ITEM_FRAME.amountRatio;


/**
 * 재화가 아닌 **아이템**의 값 한 덩어리(교류 표본처럼 그림이 glyph일 수 있는 것).
 *
 * 재화 액자와 같은 규격·같은 수량 자리를 쓰되, 정의가 든 그림이 WebP가 아닐 수 있어 glyph
 * 대체 경로를 함께 쓴다 — 그래서 `addFramedIcon` 대신 같은 값으로 직접 세운다.
 */
export function addItemPriceTag(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  itemId: string,
  amount: number,
  options: PriceTagOptions = {},
): Phaser.GameObjects.Container {
  const size = options.size ?? PRICE_TAG.size;
  const holder = scene.add.container(x, y);
  holder.add(addItemFrame(scene, 0, 0, size, { color: options.color }));
  const icon = findItem(itemId)?.icon;
  const inner = size * ITEM_FRAME.icon;
  if (icon) {
    holder.add(paintDefinitionIcon(scene, icon, ITEM_FRAME.shadow.offsetX, ITEM_FRAME.shadow.offsetY, inner, true));
    holder.add(paintDefinitionIcon(scene, icon, 0, 0, inner, false));
  }
  holder.add(scene.add
    .text(size / 2 - 8, size / 2 - 6, `${options.prefix ?? ""}${formatCurrency(amount)}`, textStyle({ role: "display", size: Math.max(18, Math.round(size * ITEM_FRAME.amountRatio)), color: options.short ? COLOR.dangerText : COLOR.accentText }))
    .setOrigin(1, 1)
    .setStroke("#000000", 6)
    .setShadow(2, 3, "#000000", 2, false, true));
  if (parent) parent.add(holder);
  return holder;
}

/** currency → asset → glyph 순서. 그늘은 같은 그림을 검게 눌러 뒤에 까는 한 겹이다. */
function paintDefinitionIcon(scene: Phaser.Scene, icon: ItemIcon, x: number, y: number, size: number, shadow: boolean): Phaser.GameObjects.GameObject {
  const key = icon.kind === "currency" ? CURRENCY_ICON_BY_WALLET[icon.key] : icon.kind === "asset" ? icon.key : undefined;
  if (key !== undefined && scene.textures.exists(key)) {
    const image = scene.add.image(x, y, key).setDisplaySize(size, size);
    return shadow ? image.setTint(0x000000).setAlpha(ITEM_FRAME.shadow.alpha) : image;
  }
  const glyph = drawGlyph(scene, icon.kind === "glyph" ? icon.key : ITEM_ICON_FALLBACK, x, y, size * 0.7, shadow ? 0x000000 : COLOR.accent);
  return shadow ? glyph.setAlpha(ITEM_FRAME.shadow.alpha) : glyph;
}
