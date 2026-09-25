import Phaser from "phaser";
import type { WalletItemKey } from "../data/items";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawInnerVignette, drawShapeOutline, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 그 화면에서 재화 액자를 누르면 무엇이 열리는가.
 *
 * **액자를 세우는 자리마다 안내창을 이어 주지 않는다.** 재화 그림이 서는 자리는 가방·상점·
 * 무역·영수증·발굴 현황까지 수십 곳이라, 한 곳씩 잇다 보면 새 화면이 생길 때마다 하나를
 * 빠뜨리고 **빠뜨린 것이 보이지 않는다**(같은 골드가 어디서는 눌리고 어디서는 눌리지 않는다).
 * 씬이 열릴 때 `bindCurrencyGuide` 한 줄만 걸면 그 뒤로 이 함수가 세우는 재화 액자는 전부
 * 눌린다.
 *
 * 씬마다 따로 들고 있어야 하므로 `WeakMap`이다 — 씬이 죽으면 함께 사라져 다음 씬에 새지 않는다.
 */
const currencyGuideOpeners = new WeakMap<Phaser.Scene, (key: WalletItemKey) => void>();

/** 그림 키에서 지갑 키로 되짚는 표. 액자는 그림만 받으므로 여기서 거꾸로 찾는다. */
const WALLET_BY_ICON = Object.fromEntries(
  Object.entries(CURRENCY_ICON_BY_WALLET).map(([wallet, icon]) => [icon, wallet as WalletItemKey]),
) as Readonly<Record<string, WalletItemKey>>;

/** 씬 하나가 제 재화 안내창을 등록한다. `src/ui/currencyGuideEntry.ts`가 유일한 호출자다. */
export function setCurrencyGuideOpener(scene: Phaser.Scene, open: (key: WalletItemKey) => void): void {
  currencyGuideOpeners.set(scene, open);
}

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
  /**
   * 눌러도 안내창을 열지 않는다.
   *
   * 안내창 **자신이** 세우는 액자(그 재화를 이미 보고 있는 자리)와, 이미 제 손짓이 걸린 칸
   * 안의 그림에만 쓴다 — 칸을 누르면 구매 확인이 떠야 하는데 그림만 다른 창을 열면 같은 칸이
   * 두 가지 일을 한다.
   */
  plain?: boolean;
}

/**
 * 그 그림이 재화면 안내창을 여는 손을 돌려준다. 액자를 `addFramedIcon`으로 세우지 않는 전용
 * 프리팹(발굴 현황의 재화 칸)도 같은 그림이면 같은 일을 하게 한다.
 */
export function currencyGuideForIcon(scene: Phaser.Scene, textureKey: string): (() => void) | undefined {
  const wallet = WALLET_BY_ICON[textureKey];
  const open = currencyGuideOpeners.get(scene);
  return wallet && open ? () => open(wallet) : undefined;
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
  // 재화 그림이면 그 자리에서 안내창이 열린다 — 어느 화면에서 보든 같은 그림은 같은 일을 한다.
  const wallet = WALLET_BY_ICON[textureKey];
  const openGuide = currencyGuideOpeners.get(scene);
  if (wallet && openGuide && !options.plain) {
    const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 누르면 커진다 — 눌린 상태를 색이 아니라 크기로 알리는 화면 전체의 규칙이다.
    hit.on("pointerdown", () => holder.setScale(1.08));
    hit.on("pointerout", () => holder.setScale(1));
    hit.on("pointerup", () => { holder.setScale(1); openGuide(wallet); });
    holder.add(hit);
  }
  if (parent) parent.add(holder);
  return holder;
}
