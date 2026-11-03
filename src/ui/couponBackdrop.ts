import Phaser from "phaser";
import { COUPON_POPUP as L } from "./couponPopupLayout";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";

/** 바탕 — 크림 → 분홍으로 흐르는 면에 물방울 무늬, 가장자리에 젬·골드·치즈케이크가 둥실 뜬다. */
export function paintCouponBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, animate: boolean): void {
  const { width, height, backdrop } = L;
  const mask = popupBodyShapeMask(scene, body, popupArtShape(width, height));
  const left = -width / 2, top = -height / 2;
  const base = scene.add.graphics();
  base.fillGradientStyle(backdrop.top, backdrop.top, backdrop.bottom, backdrop.bottom, 1).fillRect(left, top, width, height);
  for (let row = 0; row * backdrop.dotGap < height; row += 1) {
    for (let col = 0; col * backdrop.dotGap < width; col += 1) {
      base.fillStyle(backdrop.dot, backdrop.dotAlpha).fillCircle(left + 28 + col * backdrop.dotGap + (row % 2) * backdrop.dotGap / 2, top + 28 + row * backdrop.dotGap, backdrop.dotRadius);
    }
  }
  // 제목 뒤로 번지는 햇살.
  for (let ring = 6; ring > 0; ring -= 1) base.fillStyle(0xffffff, 0.08).fillEllipse(0, L.wordmark.y + 40, 260 + ring * 100, 200 + ring * 70);
  body.add(base.setMask(mask));
  L.loot.forEach(([x, y, currency, size, angle], index) => {
    const icon = scene.add.image(x, y, CURRENCY_ICON_BY_WALLET[currency]).setDisplaySize(size, size).setAngle(angle).setAlpha(0.72).setMask(mask);
    body.add(icon);
    if (animate) scene.tweens.add({ targets: icon, y: y - 10, angle: angle + 6, duration: 1600 + (index % 5) * 260, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: index * 110 });
  });
}
