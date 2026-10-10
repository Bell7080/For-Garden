import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import type { ClipRect } from "./clipRect";
import { addClippedHit } from "./clippedHit";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import { addFrameAmount, addFramedIcon } from "./itemFrame";
import { UI_ICON } from "./icons";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { paintShowcaseCard, SHOWCASE_TIER_TONE } from "./showcaseCardChrome";

export interface AdRewardCardOptions {
  x: number; y: number; width: number; height: number;
  /** 받는 재화와 수량 — 액자 한 장으로 선다. */
  currency: keyof typeof CURRENCY_ICON_BY_WALLET; amount: number;
  /** 같이 받는 재화. 있으면 액자가 둘 이상 나란히 선다. */
  extras?: readonly { currency: keyof typeof CURRENCY_ICON_BY_WALLET; amount: number }[];
  title: string;
  /** 칸 오른쪽 위에 걸리는 강조 꼬리표(예: 「특가」). 다른 광고보다 후한 칸만 단다. */
  badge?: string;
  /** 오늘 남은 횟수와 한도. 다 받았으면 버튼이 꺼진다. */
  remaining: number; limit: number;
  /** 스크롤 창 — 창 밖으로 흐른 칸이 손을 가로채지 않게 입력면이 같은 경계를 읽는다. */
  clip: () => ClipRect;
  /** 스크롤 중의 손을 누름으로 치지 않는 판정(씬이 갖는다). */
  isTap: (pointer: Phaser.Input.Pointer) => boolean;
  onWatch: () => void;
}

/**
 * 「광고 보고 받기」 한 칸 — 프리미엄 젬 탭과 일반 상점 골드 탭이 같은 한 장을 쓴다.
 *
 * 받는 것은 액자(재화 그림 + 수량), 조작은 값 줄 자리의 버튼 하나다. 오늘 몫을 다 받으면 버튼이 꺼지고
 * 남은 횟수가 붉어진다. 지급과 횟수는 서버(`claimAdReward`)가 확정하고 이 칸은 누름만 넘긴다.
 */
export function addAdRewardCard(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, options: AdRewardCardOptions): Phaser.GameObjects.Container {
  const { width, height } = options;
  const done = options.remaining <= 0;
  const card = scene.add.container(options.x, options.y);
  // 다른 상품 칸과 같은 전시대 겉모습(빗금·면 무늬)을 쓴다. 꼬리표는 격자 첫 줄에서 창 위로 잘리지 않게 칸 안쪽 오른쪽 위에 둔다.
  paintShowcaseCard(scene, card, { width, height, accent: SHOWCASE_TIER_TONE.daily, dim: done, railX: -width / 2 + 34, stageY: 0 });
  const frameSize = Math.round(height * 0.4);
  const gains = [{ currency: options.currency, amount: options.amount }, ...(options.extras ?? [])];
  const gap = Math.round(frameSize * 0.2);
  gains.forEach((gain, index) => {
    const x = (index - (gains.length - 1) / 2) * (frameSize + gap);
    const frame = addFramedIcon(scene, card, x, -height * 0.2, frameSize, CURRENCY_ICON_BY_WALLET[gain.currency], { plain: true });
    frame.add(addFrameAmount(scene, frameSize, formatCurrency(gain.amount)));
  });
  const name = scene.add.text(0, height * 0.08, options.title, textStyle({ role: "display", size: 30 })).setOrigin(0.5).setShadow(3, 4, "#04060a", 0, true, true);
  card.add(squeezeTextToWidth(name, width - 36, 0.7));
  const buttonWidth = width - 64;
  const buttonHeight = Math.round(height * 0.17);
  const bar = scene.add.container(0, height * 0.34);
  bar.add(drawLayer(scene, 0, 0, chipPoints(buttonWidth, buttonHeight, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.7 }));
  addAdCountLabel(scene, bar, 0, 0, options.remaining, options.limit, done, Math.round(buttonHeight * 0.74));
  card.add(bar);
  if (options.badge) {
    const label = scene.add.text(0, 0, options.badge, textStyle({ role: "display", size: 26, color: "#101418" })).setOrigin(0.5);
    const tagWidth = label.width + 30;
    const tag = scene.add.container(width / 2 - tagWidth / 2 - 18, -height / 2 + 26);
    tag.add(drawLayer(scene, 0, 0, slantedRect(tagWidth, 38, 12), { fill: COLOR.accent, alpha: 1, shadow: false }));
    tag.add(label);
    card.add(tag);
  }
  if (done) card.setAlpha(0.52);
  else {
    const hit = addClippedHit(scene, card, 0, 0, width, height, options.clip, { useHandCursor: true });
    hit.on("pointerdown", () => pressIn(card));
    hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { pressOut(card); if (options.isTap(pointer)) options.onWatch(); });
  }
  parent.add(card);
  return card;
}

/** 광고 칸의 간결한 표기 — 광고 아이콘과 `남은/한도`만 가운데에 나란히 세운다. */
export function addAdCountLabel(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, remaining: number, limit: number, done: boolean, iconSize: number): void {
  const label = scene.add.text(0, 0, `${remaining}/${limit}`, textStyle({ role: "display", size: 34, color: done ? COLOR.dangerText : COLOR.accentText })).setOrigin(0, 0.5).setStroke("#000000", 6);
  const gap = Math.round(iconSize * 0.2);
  const left = x - (iconSize + gap + label.width) / 2;
  label.setPosition(left + iconSize + gap, y);
  parent.add(scene.add.image(left + iconSize / 2, y, UI_ICON.ad).setDisplaySize(iconSize, iconSize));
  parent.add(label);
}
