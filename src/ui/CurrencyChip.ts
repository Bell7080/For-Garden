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
 *
 * 아래 줄(회복 시간)이 함께 서는 칸은 값이 한 뼘 작아진다 — 같은 크기로 두면 두 줄이 칸
 * 높이를 넘어 아래위로 삐져나온다.
 */
const VALUE = { ratio: 0.44, twoLineRatio: 0.36, stretch: 1.14, inset: 14, suffixRatio: 0.76, noteRatio: 0.24 } as const;

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
  /**
   * 값 아래 한 줄을 쓸 자리를 미리 비운다.
   *
   * 자리를 나중에 늘리면 값이 이미 칸 한가운데에 굳어 있어 두 줄이 아래로 쏠린다. 아래 줄을
   * 쓸 칸은 처음부터 두 줄로 세운다.
   */
  note?: boolean;
}

/** 값과 아래 줄을 갱신하는 손잡이. 칸의 자리와 크기는 만든 쪽이 정한 그대로다. */
export interface CurrencyChipHandle {
  /**
   * 값을 적는다.
   *
   * `suffix`(최대치 같은 것)는 값보다 작고 흐리게 뒤에 붙는다 — 지금 얼마인지가 먼저 읽히고
   * 상한은 그 옆의 참고 값이기 때문이다. 값은 접미사 폭만큼 왼쪽으로 물러나 오른쪽 끝은
   * 언제나 같은 자리에 선다.
   */
  setValue(text: string, suffix?: string): void;
  /** 값 아래 한 줄(회복 시간 등). 빈 문자열이면 자리를 비운다. */
  setNote(text: string): void;
}

/** 칸 하나를 만든다. 갱신은 돌려주는 손잡이로 한다. */
export function addCurrencyChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: CurrencyIconKey,
  options: CurrencyChipOptions = {},
): CurrencyChipHandle {
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
  const twoLine = options.note === true;
  const valueSize = Math.round(height * (twoLine ? VALUE.twoLineRatio : VALUE.ratio));
  const valueY = twoLine ? -height * 0.14 : 0;
  const right = width / 2 - VALUE.inset;
  const value = scene.add
    .text(right, valueY, "", textStyle({ role: "display", size: valueSize, color: options.color ?? COLOR.ink }))
    .setOrigin(1, 0.5)
    .setScale(1, VALUE.stretch)
    .setShadow(2, 5, "#05070a", 6, false, true);
  // 상한과 회복 시간은 참고 값이라 얇은 회색이다. 값과 같은 무게로 두면 어느 수가 지금
  // 가진 것인지 한 번에 읽히지 않는다.
  const suffix = scene.add
    .text(right, valueY, "", textStyle({ role: "body", size: Math.round(valueSize * VALUE.suffixRatio), color: COLOR.inkDim }))
    .setOrigin(1, 0.5)
    .setShadow(2, 4, "#05070a", 5, false, true);
  const note = scene.add
    .text(right, height * 0.24, "", textStyle({ role: "body", size: Math.round(height * VALUE.noteRatio), color: COLOR.inkDim }))
    .setOrigin(1, 0.5)
    .setShadow(2, 4, "#05070a", 5, false, true);
  chip.add([value, suffix, note]);
  options.parent?.add(chip);
  if (options.currency && options.onClick) {
    // 투명 입력면은 보이는 칩 전체와 일치하고 눌림은 칸 하나를 통째로 키워 알린다.
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => chip.setScale(1.08));
    hit.on("pointerout", () => chip.setScale(1));
    hit.on("pointerup", () => { chip.setScale(1); options.onClick?.(options.currency!); });
    chip.add(hit);
  }
  return {
    setValue: (text, tail = "") => {
      suffix.setText(tail);
      // 접미사가 오른쪽 끝을 차지하고 값이 그만큼 왼쪽으로 물러난다. 순서를 뒤집으면 자릿수가
      // 늘 때마다 상한이 칸 밖으로 밀린다.
      value.setText(text).setX(right - suffix.width);
    },
    setNote: (text) => note.setText(text),
  };
}
