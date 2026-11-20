import Phaser from "phaser";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";

/**
 * 사탕 결 안내창(쿠폰·피드백·사전예약·베타 안내)의 바탕. 마스크로 판 실루엣을 자르므로 입력면은 이 파일에 두지 않는다
 * (`clippedHit.test` — 손을 받는 조각은 `candyPopupKit.ts`가 맡는다).
 */
export interface CandyBackdrop {
  width: number;
  height: number;
  top: number;
  bottom: number;
  /** 제목 뒤 햇살이 번지는 높이. */
  glowY: number;
  /** 판 가장자리에 흩어지는 재화 그림(x·y·재화·크기·기울기). */
  loot?: readonly (readonly [number, number, keyof typeof CURRENCY_ICON_BY_WALLET, number, number])[];
}

/** 바탕 — 두 색으로 흐르는 면에 물방울 무늬, 제목 뒤 햇살, 가장자리의 재화 그림. */
export function paintCandyBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, spec: CandyBackdrop, animate: boolean): void {
  const { width, height } = spec;
  const mask = popupBodyShapeMask(scene, body, popupArtShape(width, height));
  const left = -width / 2, top = -height / 2, gap = 56;
  const base = scene.add.graphics();
  base.fillGradientStyle(spec.top, spec.top, spec.bottom, spec.bottom, 1).fillRect(left, top, width, height);
  for (let row = 0; row * gap < height; row += 1) {
    for (let col = 0; col * gap < width; col += 1) base.fillStyle(0xffffff, 0.38).fillCircle(left + 28 + col * gap + (row % 2) * gap / 2, top + 28 + row * gap, 5);
  }
  for (let ring = 6; ring > 0; ring -= 1) base.fillStyle(0xffffff, 0.08).fillEllipse(0, spec.glowY + 40, 260 + ring * 100, 200 + ring * 70);
  body.add(base.setMask(mask));
  (spec.loot ?? []).forEach(([x, y, currency, size, angle], index) => {
    const icon = scene.add.image(x, y, CURRENCY_ICON_BY_WALLET[currency]).setDisplaySize(size, size).setAngle(angle).setAlpha(0.72).setMask(mask);
    body.add(icon);
    if (animate) scene.tweens.add({ targets: icon, y: y - 10, angle: angle + 6, duration: 1600 + (index % 5) * 260, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: index * 110 });
  });
}
