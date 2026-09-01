import Phaser from "phaser";
import type { CurrencyIconKey } from "./currencyIcons";
import type { WalletItemKey } from "../data/items";
import { drawRoundedLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 재화 한 칸.
 *
 * 상단 재화 줄과 팝업 안의 보유량이 같은 모양을 쓰도록 여기 한 곳에서만 그린다. 화면마다
 * 제 나름의 "골드 25,400"을 적으면 같은 값이 어디서는 칸으로, 어디서는 글자로 보인다.
 *
 * 판때기 대신 살짝 어두운 둥근 유리 조각 하나를 깔고, 아이콘은 그 왼쪽 안쪽에 넉넉히 앉는다.
 * 이 줄만 기울이지 않고 둥근 면을 쓰는 이유는 `drawRoundedLayer`에 적어 두었다.
 */
export const CURRENCY_CHIP = { width: 168, height: 74, icon: 62, gap: 24 } as const;

/**
 * 값 글자의 크기와 세로 늘임.
 *
 * 재화는 화면에서 가장 자주 훑는 수라 다른 라벨보다 굵고 커야 한다. 가로로 키우면 칸이
 * 함께 넓어지므로 **세로로만** 늘여 자릿수는 그대로 두고 눈에는 크게 잡히게 한다.
 */
const VALUE = { ratio: 0.44, stretch: 1.14, inset: 14 } as const;

export interface CurrencyChipOptions {
  /** 칸의 가로 폭. 좁은 팝업에서는 줄여 쓴다. */
  width?: number;
  height?: number;
  color?: string;
  /** 담을 컨테이너. 주지 않으면 씬에 바로 올린다. */
  parent?: Phaser.GameObjects.Container;
  /** 안내 진입을 원하는 호출부만 키와 콜백을 함께 주며, 없으면 입력면을 만들지 않는다. */
  currency?: WalletItemKey;
  onClick?: (currency: WalletItemKey) => void;
}

/** 값 텍스트를 돌려준다. 갱신은 부르는 쪽이 `setText`로 한다. */
export function addCurrencyChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: CurrencyIconKey,
  options: CurrencyChipOptions = {},
): Phaser.GameObjects.Text {
  const width = options.width ?? CURRENCY_CHIP.width;
  const height = options.height ?? CURRENCY_CHIP.height;
  const iconSize = Math.round(height * (CURRENCY_CHIP.icon / CURRENCY_CHIP.height));
  const plate = drawRoundedLayer(scene, x, y, width, height, { fill: 0x05070a, alpha: 0.46, radius: height / 2 });
  // 아이콘은 칸 안쪽에 온전히 들어간다. 잘린 모서리에 걸치면 그림이 반쯤 잘려 보인다.
  // 칸을 좁힌 만큼 아이콘도 왼쪽 끝에 더 붙어, 그림과 수가 한 덩어리로 읽힌다.
  const iconX = x - width / 2 + iconSize * 0.52;
  const shadow = scene.add.image(iconX + 3, y + 4, icon).setDisplaySize(iconSize, iconSize).setTint(0x05070a).setAlpha(0.55);
  const image = scene.add.image(iconX, y, icon).setDisplaySize(iconSize, iconSize);
  const value = scene.add
    .text(x + width / 2 - VALUE.inset, y, "", textStyle({ role: "display", size: Math.round(height * VALUE.ratio), color: options.color ?? COLOR.ink }))
    .setOrigin(1, 0.5)
    .setScale(1, VALUE.stretch)
    .setShadow(2, 5, "#05070a", 6, false, true);
  options.parent?.add([plate, shadow, image, value]);
  if (options.currency && options.onClick) {
    // 투명 입력면은 보이는 칩 전체와 일치하고 눌림은 구성 요소를 한 덩어리로 확대해 알린다.
    const controls = [plate, shadow, image, value];
    const hit = scene.add.rectangle(x, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const scale = (amount: number): void => controls.forEach((node) => node.setScale(amount));
    hit.on("pointerdown", () => scale(1.08)); hit.on("pointerout", () => scale(1));
    hit.on("pointerup", () => { scale(1); options.onClick?.(options.currency!); });
    options.parent?.add(hit);
  }
  return value;
}
