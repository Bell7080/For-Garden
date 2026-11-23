import Phaser from "phaser";
import { t } from "../i18n";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import { drawGlyph, type GlyphName } from "./glyphs";
import { pressIn, pressOut } from "./pressFeedback";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { SUBSCRIPTION_NOTICE } from "./subscriptionNoticeLayout";

/** 정기권 결제 안내 한 쌍 — 결제 팝업에 서는 한 줄과, 그 줄의 ⓘ가 여는 자세한 안내창. */
export interface SubscriptionNoticeInput {
  /** 이미 서식이 입혀진 스토어 가격 문자열. */
  price: string;
  days: number;
}

/** 자세한 안내의 항목 — 제목과 본문 키가 항상 한 쌍이다. */
const SECTIONS = ["billing", "renew", "cancel", "refund"] as const;

/** 값 버튼 위 한 줄. 문장은 번역 표가 갖고 여기서는 자리 값만 채운다. */
export function subscriptionNoticeLine(input: SubscriptionNoticeInput): string {
  return t("shop.renewal.notice", { price: input.price, days: input.days });
}

/** 줄 오른쪽 끝에 서는 작은 ⓘ 칩. 눌러 자세한 안내창을 연다. */
export function addSubscriptionNoticeChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, onOpen: () => void): Phaser.GameObjects.Container {
  const S = SUBSCRIPTION_NOTICE.chip;
  const chip = scene.add.container(x, y);
  chip.add(drawLayer(scene, 0, 0, slantedRect(S.size, S.size, 10), { fill: 0x101720, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.8 }));
  chip.add(scene.add.text(0, 0, "i", textStyle({ role: "display", size: 26, color: COLOR.accentText })).setOrigin(0.5));
  const hit = scene.add.zone(0, 0, S.hit, S.hit).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(chip));
  hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(chip); onOpen(); });
  chip.add(hit);
  parent.add(chip);
  return chip;
}

/** 항목마다의 머리 그림 — 결제 · 갱신 · 해지 · 환불. */
const SECTION_GLYPH: Record<(typeof SECTIONS)[number], GlyphName> = { billing: "receipt", renew: "refresh", cancel: "remove", refund: "exchange" };

/**
 * 결제 주기·갱신·해지·환불을 항목별로 읽는 안내창. 맨 위 판에 **값과 주기**가 크게 서고(무엇에 동의하는지가 먼저 읽힌다),
 * 그 아래 항목마다 유리 판 한 장에 그림 · 제목 · 풀이가 선다. 높이는 글이 차지하는 만큼에서 거꾸로 구한다.
 */
export function openSubscriptionNoticePopup(scene: Phaser.Scene, popups: PopupLayer, input: SubscriptionNoticeInput): void {
  const L = SUBSCRIPTION_NOTICE.detail;
  const textWidth = L.width - L.pad * 2 - L.cardPad * 2;
  const bodies = SECTIONS.map((key) => t(`shop.renewal.${key}.body`, { price: input.price, days: input.days }));
  const heights = bodies.map((text) => {
    const probe = scene.add.text(0, 0, text, textStyle({ role: "body", size: L.bodySize, wrap: textWidth })).setVisible(false);
    const height = probe.height; probe.destroy(); return height;
  });
  const cardHeights = heights.map((h) => L.cardPad * 2 + L.headSize + L.headGap + h);
  const total = L.summary.height + L.summary.gap + cardHeights.reduce((sum, h) => sum + h, 0) + (SECTIONS.length - 1) * L.sectionGap;
  const height = Math.ceil(total + L.top + L.bottom);
  popups.open({ width: L.width, height, title: t("shop.renewal.title"), dim: true, dimAlpha: 0.34, closeOnBackdrop: true }, (body) => {
    const cardWidth = L.width - L.pad * 2;
    let y = -height / 2 + L.top;
    // 값 판 — 스토어 가격과 주기(`30D`)가 한 줄에 크게 선다. 갱신 그림이 「다시 결제된다」를 말한다.
    const sy = y + L.summary.height / 2;
    body.add(drawLayer(scene, 0, sy, chipPoints(cardWidth, L.summary.height, { bevel: { topLeft: 22, bottomRight: 22 } }), { fill: 0x1a1608, alpha: 0.9, edge: COLOR.accent, edgeWidth: 4, glow: { color: COLOR.accent, strength: 0.25 } }));
    const price = scene.add.text(0, sy, input.price, textStyle({ role: "display", size: L.summary.priceSize, color: COLOR.accentText })).setOrigin(0.5).setStroke("#0a0e14", 8);
    const cycle = scene.add.text(0, sy + 4, `/ ${input.days}D`, textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(0.5);
    const iconSize = 44, gap = 16;
    const rowWidth = iconSize + gap + price.width + 12 + cycle.width;
    const startX = -rowWidth / 2;
    body.add(drawGlyph(scene, "refresh", startX + iconSize / 2, sy, iconSize, COLOR.accent));
    price.setX(startX + iconSize + gap + price.width / 2);
    cycle.setX(price.x + price.width / 2 + 12 + cycle.width / 2);
    body.add([price, cycle]);
    y += L.summary.height + L.summary.gap;
    SECTIONS.forEach((key, index) => {
      const cardHeight = cardHeights[index];
      body.add(drawLayer(scene, 0, y + cardHeight / 2, chipPoints(cardWidth, cardHeight, { bevel: { topLeft: 18, bottomRight: 18 } }), { fill: 0x0f141b, alpha: 0.78, shadow: false, edge: COLOR.accent, edgeAlpha: 0.4 }));
      const left = -cardWidth / 2 + L.cardPad;
      const headY = y + L.cardPad + L.headSize / 2;
      body.add(drawGlyph(scene, SECTION_GLYPH[key], left + L.icon / 2, headY, L.icon, COLOR.accent));
      body.add(scene.add.text(left + L.icon + 14, headY, t(`shop.renewal.${key}.title`), textStyle({ role: "display", size: L.headSize, color: COLOR.accentText })).setOrigin(0, 0.5));
      body.add(scene.add.text(left, y + L.cardPad + L.headSize + L.headGap, bodies[index], textStyle({ role: "body", size: L.bodySize, color: COLOR.ink, wrap: textWidth })).setOrigin(0, 0));
      y += cardHeight + L.sectionGap;
    });
  });
}
