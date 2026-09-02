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
  /**
   * 값 글자 크기의 칸 높이 대비 비율.
   *
   * `60/122`처럼 한 칸에 두 수를 함께 적는 재화만 줄인다 — 기본 크기로 두면 글자가 칸을 넘는다.
   */
  valueRatio?: number;
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
  // 칸을 이루는 것들은 모두 이 컨테이너 안의 **국소 좌표**에 선다. 눌림은 컨테이너 하나만
  // 키우면 되므로, 각 조각의 배율(아이콘은 `setDisplaySize`가, 값 글자는 세로 늘임이 이미
  // 쓰고 있다)을 건드리지 않는다 — 그 배율을 덮어쓰면 그림이 원본 크기로 튀어 돌아오지 않는다.
  const chip = scene.add.container(x, y);
  chip.add(drawRoundedLayer(scene, 0, 0, width, height, { fill: 0x05070a, alpha: 0.46, radius: height / 2 }));
  // 아이콘은 칸 안쪽에 온전히 들어간다. 잘린 모서리에 걸치면 그림이 반쯤 잘려 보인다.
  // 칸을 좁힌 만큼 아이콘도 왼쪽 끝에 더 붙어, 그림과 수가 한 덩어리로 읽힌다.
  const iconX = -width / 2 + iconSize * 0.52;
  chip.add(scene.add.image(iconX + 3, 4, icon).setDisplaySize(iconSize, iconSize).setTint(0x05070a).setAlpha(0.55));
  chip.add(scene.add.image(iconX, 0, icon).setDisplaySize(iconSize, iconSize));
  const value = scene.add
    .text(width / 2 - VALUE.inset, 0, "", textStyle({ role: "display", size: Math.round(height * (options.valueRatio ?? VALUE.ratio)), color: options.color ?? COLOR.ink }))
    .setOrigin(1, 0.5)
    .setScale(1, VALUE.stretch)
    .setShadow(2, 5, "#05070a", 6, false, true);
  chip.add(value);
  options.parent?.add(chip);
  if (options.currency && options.onClick) {
    // 투명 입력면은 보이는 칩 전체와 일치하고 눌림은 칸 하나를 통째로 키워 알린다.
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => chip.setScale(1.08));
    hit.on("pointerout", () => chip.setScale(1));
    hit.on("pointerup", () => { chip.setScale(1); options.onClick?.(options.currency!); });
    chip.add(hit);
  }
  return value;
}
