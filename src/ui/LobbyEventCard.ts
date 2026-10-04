import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { LobbyEventDef } from "../data/lobbyEvents";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import type { LobbyEventRemaining } from "./lobbyEventModel";
import { addPopupBackgroundImage } from "./backgrounds";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 카드 한 장의 겹과 자리. 무역 전시장 카드와 같은 문법(뒤로 번지는 어둠 · 윗변 강조선 · 왼쪽 빗금)이다. */
const CARD = {
  bevel: 0.16,
  fill: 0x16140d,
  fillAlpha: 0.94,
  shadow: [{ grow: 14, offsetY: 10, alpha: 0.34 }, { grow: 30, offsetY: 20, alpha: 0.18 }],
  glow: { strength: 0.26, height: 0.6 },
  padX: 40,
  rail: { width: 10, inset: 16, alpha: 0.9 },
  titleSize: 40,
  subtitleSize: 26,
  /** 남은 기간 칩. 카드 오른쪽 아래에 앉는다. */
  remaining: { width: 196, height: 50, size: 24, inset: 26 },
} as const;

const REMAINING_KEY: Readonly<Record<LobbyEventRemaining["unit"], TextKey>> = {
  days: "event.remaining.days",
  hours: "event.remaining.hours",
  minutes: "event.remaining.minutes",
};

export interface LobbyEventCardOptions {
  width: number;
  height: number;
  event: LobbyEventDef;
  remaining: LobbyEventRemaining;
  onClick: () => void;
}

/**
 * 로비 이벤트 판의 한 장.
 *
 * **카드 자체가 버튼이다** — 무역처럼 줄 끝에 「들어가기」를 세우지 않는다. 이름이 크게, 부제가
 * 그 아래 흐리게, 남은 기간이 오른쪽 아래 노란 칩으로 선다.
 */
export class LobbyEventCard extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: LobbyEventCardOptions) {
    super(scene, x, y);
    const { width, height, event, remaining } = options;
    const bevel = Math.min(width, height) * CARD.bevel;
    const cut = { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 };
    const left = -width / 2 + CARD.padX;

    for (const { grow, offsetY, alpha } of CARD.shadow) {
      this.add(drawLayer(scene, 0, offsetY, chipPoints(width + grow, height + grow, { bevel: cut }), { fill: 0x000000, alpha, shadow: false }));
    }
    this.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: cut }), {
      fill: CARD.fill, alpha: CARD.fillAlpha, sheen: 0.05,
      glow: { color: COLOR.event, strength: CARD.glow.strength, height: CARD.glow.height },
      edge: COLOR.event, edgeAlpha: 0.9, edgeWidth: 3,
    }));
    // 이벤트에 어울리는 원화가 있으면 카드 뒷배경으로 깐다. 글이 서는 왼쪽은 어둡게 눌러 읽히게 하고
    // 원화는 오른쪽에서 드러난다. 판 실루엣과 같은 도형으로 잘라 깎인 모서리 밖으로 새지 않는다.
    if (event.backdropKey) {
      addPopupBackgroundImage(scene, this, event.backdropKey, {
        x: 0, y: 0, width, height, maskShape: chipPoints(width, height, { bevel: cut }), imageAlpha: 0.9, overlayStrength: 0.6,
      });
      const veil = scene.add.graphics();
      veil.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.78, 0, 0.78, 0);
      veil.fillRect(-width / 2, -height / 2, width * 0.7, height);
      this.add(veil);
    }
    this.add(drawLayer(scene, left - CARD.rail.inset, 0, slantedRect(CARD.rail.width, height * 0.6), {
      fill: COLOR.event, alpha: CARD.rail.alpha, shadow: false,
    }));

    const textWidth = width - CARD.padX * 2;
    const title = scene.add.text(left, -height / 2 + 64, t(event.titleKey), textStyle({ role: "display", size: CARD.titleSize, color: COLOR.ink }))
      .setOrigin(0, 0.5)
      .setShadow(3, 4, "#04060a", 0, true, true);
    shrinkTextToWidth(title, textWidth);
    this.add(title);
    const subtitle = scene.add.text(left, -height / 2 + 116, t(event.subtitleKey), textStyle({ role: "body", size: CARD.subtitleSize, color: COLOR.inkDim }))
      .setOrigin(0, 0.5);
    shrinkTextToWidth(subtitle, textWidth);
    this.add(subtitle);

    const chip = CARD.remaining;
    const chipX = width / 2 - chip.inset - chip.width / 2 - bevel * 0.4;
    const chipY = height / 2 - chip.inset - chip.height / 2;
    this.add(drawLayer(scene, chipX, chipY, slantedRect(chip.width, chip.height), { fill: 0x000000, alpha: 0.55, shadow: false, edge: COLOR.event, edgeAlpha: 0.7 }));
    const remainingText = scene.add.text(chipX, chipY, t(REMAINING_KEY[remaining.unit], { value: remaining.value }), textStyle({ role: "emphasis", size: chip.size, color: COLOR.eventText }))
      .setOrigin(0.5);
    squeezeTextToWidth(remainingText, chip.width - 24);
    this.add(remainingText);

    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(this));
    hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(this); options.onClick(); });
    this.add(hit);
    this.setSize(width, height);
  }
}
